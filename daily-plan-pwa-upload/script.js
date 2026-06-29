const STORAGE_KEY = "daily-bloom-plans-v1";
const TEMPLATE_KEY = "daily-bloom-template-v1";
const WEATHER_KEY = "daily-bloom-weather-higashihiroshima-v1";
const DEFAULT_MINIMUM_GOAL = 3;
const WEATHER_CACHE_MS = 60 * 60 * 1000;
const CATEGORIES = ["学习", "兼职", "生活", "补充剂", "申请材料", "休息"];
const DEFAULT_TEMPLATE = [
  { time: "08:30", text: "起床", category: "生活", important: false },
  { time: "09:00", text: "早餐", category: "生活", important: false },
  { time: "09:30", text: "复习大学院考试", category: "学习", important: true },
  { time: "12:00", text: "午饭", category: "生活", important: false },
  { time: "14:00", text: "学习/兼职", category: "学习", important: true },
  { time: "18:00", text: "晚饭", category: "生活", important: false },
  { time: "20:00", text: "整理材料/背书", category: "申请材料", important: true },
  { time: "22:30", text: "洗澡护肤", category: "生活", important: false },
  { time: "23:30", text: "准备睡觉", category: "休息", important: false },
  { time: "10:00", text: "铁剂 + 维生素C", category: "补充剂", important: false },
  { time: "12:30", text: "D3", category: "补充剂", important: false },
  { time: "18:30", text: "复合维生素B", category: "补充剂", important: false }
];

const state = {
  selectedDateKey: formatDateKey(new Date()),
  plans: readJSON(STORAGE_KEY, {}),
  template: readJSON(TEMPLATE_KEY, DEFAULT_TEMPLATE),
  collapsedCompleted: false,
  prepOpen: true,
  prepShowAll: false
};

const els = {
  dateLabel: document.querySelector("#dateLabel"),
  openDatePicker: document.querySelector("#openDatePicker"),
  datePicker: document.querySelector("#datePicker"),
  todayButton: document.querySelector("#todayButton"),
  weatherLine: document.querySelector("#weatherLine"),
  flowerCount: document.querySelector("#flowerCount"),
  flowerBurst: document.querySelector("#flowerBurst"),
  todoList: document.querySelector("#todoList"),
  completedList: document.querySelector("#completedList"),
  todoCount: document.querySelector("#todoCount"),
  doneCount: document.querySelector("#doneCount"),
  taskForm: document.querySelector("#taskForm"),
  taskTime: document.querySelector("#taskTime"),
  taskText: document.querySelector("#taskText"),
  toggleCompleted: document.querySelector("#toggleCompleted"),
  templateDialog: document.querySelector("#templateDialog"),
  openTemplate: document.querySelector("#openTemplate"),
  templateText: document.querySelector("#templateText"),
  saveTemplate: document.querySelector("#saveTemplate"),
  resetTemplate: document.querySelector("#resetTemplate"),
  dailyFeeling: document.querySelector("#dailyFeeling"),
  dailyFeelingDisplay: document.querySelector("#dailyFeelingDisplay"),
  dailyFeelingEditor: document.querySelector("#dailyFeelingEditor"),
  togglePrep: document.querySelector("#togglePrep"),
  togglePrepMore: document.querySelector("#togglePrepMore"),
  prepPanel: document.querySelector("#prepPanel"),
  prepList: document.querySelector("#prepList"),
  prepForm: document.querySelector("#prepForm"),
  prepText: document.querySelector("#prepText"),
  prepCount: document.querySelector("#prepCount")
};

init();

function init() {
  els.datePicker.value = state.selectedDateKey;

  els.taskForm.addEventListener("submit", addTask);
  els.toggleCompleted.addEventListener("click", toggleCompletedList);
  els.openDatePicker.addEventListener("click", openDatePicker);
  els.datePicker.addEventListener("change", () => {
    if (!els.datePicker.value) return;
    state.selectedDateKey = els.datePicker.value;
    render();
  });
  els.todayButton.addEventListener("click", () => {
    state.selectedDateKey = formatDateKey(new Date());
    render();
  });
  els.openTemplate.addEventListener("click", openTemplateDialog);
  els.saveTemplate.addEventListener("click", saveTemplate);
  els.resetTemplate.addEventListener("click", resetTemplate);
  els.dailyFeeling.addEventListener("input", saveDailyFeeling);
  els.dailyFeelingDisplay.addEventListener("click", () => {
    els.dailyFeelingEditor.hidden = false;
    els.dailyFeeling.focus();
  });
  els.dailyFeeling.addEventListener("blur", () => {
    if (!els.dailyFeeling.value.trim()) els.dailyFeelingEditor.hidden = true;
  });
  els.togglePrep.addEventListener("click", togglePrep);
  els.togglePrepMore.addEventListener("click", togglePrepMore);
  els.prepForm.addEventListener("submit", addPrepItem);

  render();
  loadWeather();
}

function addTask(event) {
  event.preventDefault();
  const plan = getCurrentPlan();
  plan.tasks.push({
    id: createId(),
    time: els.taskTime.value,
    text: els.taskText.value.trim(),
    category: "生活",
    important: false,
    done: false,
    createdAt: Date.now()
  });
  savePlans();
  els.taskForm.reset();
  render();
}

function render() {
  const key = state.selectedDateKey;
  const date = parseDateKey(key);
  ensurePlan(key);
  const plan = state.plans[key];
  normalizePlan(plan);
  const tasks = [...plan.tasks].sort(sortTasks);
  const todo = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  const isToday = key === formatDateKey(new Date());
  els.dateLabel.textContent = formatDateLabel(date, key);
  els.datePicker.value = key;
  els.todayButton.hidden = isToday;
  els.flowerCount.textContent = done.length;
  els.todoCount.textContent = todo.length;
  els.doneCount.textContent = done.length;

  els.todoList.replaceChildren(...todo.map((task) => createTaskElement(task, "todo")));
  els.completedList.replaceChildren(...done.map((task) => createTaskElement(task, "done")));
  els.completedList.classList.toggle("collapsed", state.collapsedCompleted);
  els.toggleCompleted.setAttribute("aria-expanded", String(!state.collapsedCompleted));

  els.dailyFeeling.value = plan.notes.dailyFeeling;
  els.dailyFeelingDisplay.textContent = `今日一句：${plan.notes.dailyFeeling || "今天完成一点点也很好。"}`;
  els.dailyFeelingEditor.hidden = !plan.notes.dailyFeeling;
  const visiblePrep = state.prepShowAll ? plan.prep : plan.prep.slice(0, 3);
  els.prepList.replaceChildren(...visiblePrep.map(createPrepElement));
  els.prepCount.textContent = `${plan.prep.filter((item) => item.done).length}/${plan.prep.length}`;
  els.prepPanel.hidden = !state.prepOpen;
  els.togglePrep.setAttribute("aria-expanded", String(state.prepOpen));
  els.togglePrepMore.hidden = plan.prep.length <= 3 || !state.prepOpen;
  els.togglePrepMore.textContent = state.prepShowAll ? "收起" : `展开全部 ${plan.prep.length} 条`;
}

function createTaskElement(task, context) {
  const item = document.createElement("div");
  item.className = `task-item ${task.done ? "done" : ""}`;
  item.dataset.id = task.id;
  if (context === "done") item.classList.add("move-in");

  const checkbox = document.createElement("input");
  checkbox.className = "task-check";
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.setAttribute("aria-label", task.done ? "取消完成" : "标记完成");
  checkbox.addEventListener("change", () => setTaskDone(task.id, checkbox.checked));

  const main = document.createElement("div");
  main.className = "task-main";
  const line = document.createElement("div");
  line.className = "task-line";
  line.innerHTML = `<span class="task-time">${escapeHTML(task.time || "--:--")}</span><span class="task-title">${escapeHTML(task.text)}</span>`;
  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.innerHTML = task.carriedFrom ? '<span class="tag carryover">顺延</span>' : "";
  main.append(line);
  if (meta.innerHTML) main.append(meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const reward = document.createElement("span");
  reward.className = `task-flower ${task.done ? "earned" : "empty"}`;
  reward.textContent = task.done ? "🌸" : "♡";
  reward.setAttribute("aria-label", task.done ? "已获得小红花" : "未获得小红花");
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", "编辑任务");
  edit.addEventListener("click", () => editTask(task.id));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "删除任务");
  remove.addEventListener("click", () => deleteTask(task.id));
  actions.append(reward, edit, remove);

  item.append(checkbox, main, actions);
  return item;
}

function setTaskDone(id, done) {
  const task = getCurrentPlan().tasks.find((item) => item.id === id);
  if (!task) return;
  const wasDone = task.done;
  task.done = done;
  if (task.category === "补充剂" && Object.prototype.hasOwnProperty.call(getCurrentPlan().supplements, task.text)) {
    getCurrentPlan().supplements[task.text] = done;
  }
  savePlans();
  if (!wasDone && done) popFlower();
  render();
}

function editTask(id) {
  const task = getCurrentPlan().tasks.find((item) => item.id === id);
  if (!task) return;
  const time = prompt("修改时间，例如 09:30", task.time);
  if (time === null) return;
  const text = prompt("修改任务内容", task.text);
  if (text === null || !text.trim()) return;
  task.time = normalizeTime(time) || task.time;
  task.text = text.trim();
  savePlans();
  render();
}

function deleteTask(id) {
  if (!confirm("确定删除这条任务吗？")) return;
  const plan = getCurrentPlan();
  const task = plan.tasks.find((item) => item.id === id);
  if (task && task.carryoverKey && !plan.dismissedCarryovers.includes(task.carryoverKey)) {
    plan.dismissedCarryovers.push(task.carryoverKey);
  }
  if (task) dismissMatchingCarryover(task, plan);
  plan.tasks = plan.tasks.filter((task) => task.id !== id);
  savePlans();
  render();
}

function dismissMatchingCarryover(task, plan) {
  const previousKey = getRelativeDateKey(state.selectedDateKey, -1);
  const previousPlan = state.plans[previousKey];
  if (!previousPlan) return;
  normalizePlan(previousPlan);
  const source = previousPlan.tasks.find((item) => !item.done && item.time === task.time && item.text === task.text);
  if (!source) return;
  const carryoverKey = `${previousKey}:${source.id}`;
  if (!plan.dismissedCarryovers.includes(carryoverKey)) {
    plan.dismissedCarryovers.push(carryoverKey);
  }
}

function togglePrep() {
  state.prepOpen = !state.prepOpen;
  render();
}

function togglePrepMore() {
  state.prepShowAll = !state.prepShowAll;
  render();
}

function addPrepItem(event) {
  event.preventDefault();
  const text = els.prepText.value.trim();
  if (!text) return;
  const plan = getCurrentPlan();
  normalizePlan(plan);
  plan.prep.push({ id: createId(), text, done: false, createdAt: Date.now() });
  els.prepForm.reset();
  savePlans();
  render();
}

function createPrepElement(item) {
  const row = document.createElement("div");
  row.className = `prep-item ${item.done ? "done" : ""}`;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.done;
  checkbox.setAttribute("aria-label", item.done ? "取消准备完成" : "标记准备完成");
  checkbox.addEventListener("change", () => {
    item.done = checkbox.checked;
    savePlans();
    render();
  });
  const text = document.createElement("span");
  text.textContent = item.text;
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "✎";
  edit.setAttribute("aria-label", "编辑明日准备");
  edit.addEventListener("click", () => {
    const next = prompt("修改明日准备", item.text);
    if (next === null || !next.trim()) return;
    item.text = next.trim();
    savePlans();
    render();
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "删除明日准备");
  remove.addEventListener("click", () => {
    const plan = getCurrentPlan();
    plan.prep = plan.prep.filter((prep) => prep.id !== item.id);
    savePlans();
    render();
  });
  row.append(checkbox, text, edit, remove);
  return row;
}

function toggleCompletedList() {
  state.collapsedCompleted = !state.collapsedCompleted;
  render();
}

function openTemplateDialog() {
  els.templateText.value = templateToText(state.template);
  if (typeof els.templateDialog.showModal === "function") {
    els.templateDialog.showModal();
  } else {
    alert("当前浏览器不支持弹窗编辑，请换用 Safari/Chrome 的新版本。");
  }
}

function openDatePicker() {
  if (typeof els.datePicker.showPicker === "function") {
    els.datePicker.showPicker();
    return;
  }
  els.datePicker.focus();
  els.datePicker.click();
}

function saveTemplate() {
  state.template = parseTemplateText(els.templateText.value);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state.template));
  els.templateDialog.close();
}

function resetTemplate() {
  state.template = [...DEFAULT_TEMPLATE];
  els.templateText.value = templateToText(state.template);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(state.template));
}

function saveDailyFeeling() {
  const plan = getCurrentPlan();
  normalizePlan(plan);
  plan.notes.dailyFeeling = els.dailyFeeling.value;
  savePlans();
  els.dailyFeelingDisplay.textContent = `今日一句：${plan.notes.dailyFeeling || "今天完成一点点也很好。"}`;
}

function popFlower() {
  els.flowerBurst.classList.remove("pop");
  void els.flowerBurst.offsetWidth;
  els.flowerBurst.classList.add("pop");
}

function getCurrentPlan() {
  return state.plans[state.selectedDateKey];
}

function ensurePlan(key) {
  let changed = false;
  if (state.plans[key]) {
    changed = normalizePlan(state.plans[key]);
  } else {
    state.plans[key] = {
      tasks: state.template.map((task) => ({
        ...task,
        id: createId(),
        done: false,
        createdAt: Date.now()
      })),
      notes: {
        dailyFeeling: ""
      },
      prep: defaultPrepItems(),
      dismissedCarryovers: [],
      minimumGoal: DEFAULT_MINIMUM_GOAL
    };
    changed = true;
  }
  changed = applyCarryovers(key, state.plans[key]) || changed;
  if (changed) savePlans();
}

function normalizePlan(plan) {
  let changed = false;
  if (!Array.isArray(plan.tasks)) {
    plan.tasks = [];
    changed = true;
  }
  if (!plan.notes) {
    plan.notes = {};
    changed = true;
  }
  if (typeof plan.notes.dailyFeeling !== "string") {
    plan.notes.dailyFeeling = "";
    changed = true;
  }
  if (!Array.isArray(plan.prep)) {
    plan.prep = defaultPrepItems();
    changed = true;
  }
  if (!Array.isArray(plan.dismissedCarryovers)) {
    plan.dismissedCarryovers = [];
    changed = true;
  }
  if (!plan.minimumGoal) {
    plan.minimumGoal = DEFAULT_MINIMUM_GOAL;
    changed = true;
  }
  return changed;
}

function applyCarryovers(key, plan) {
  const previousKey = getRelativeDateKey(key, -1);
  const previousPlan = state.plans[previousKey];
  if (!previousPlan) return false;
  normalizePlan(previousPlan);
  let changed = false;
  previousPlan.tasks.forEach((task) => {
    const carryoverKey = `${previousKey}:${task.id}`;
    const existingIndex = plan.tasks.findIndex((item) => item.carryoverKey === carryoverKey);
    if (task.done) {
      if (existingIndex !== -1) {
        plan.tasks.splice(existingIndex, 1);
        changed = true;
      }
      return;
    }
    const sameVisibleTask = plan.tasks.some((item) => !item.carryoverKey && item.time === task.time && item.text === task.text);
    if (existingIndex !== -1 || sameVisibleTask || plan.dismissedCarryovers.includes(carryoverKey)) return;
    plan.tasks.push({
      id: createId(),
      time: task.time,
      text: task.text,
      category: task.category || "生活",
      important: Boolean(task.important),
      done: false,
      createdAt: Date.now(),
      carriedFrom: previousKey,
      carryoverKey
    });
    changed = true;
  });
  return changed;
}

function defaultPrepItems() {
  return ["洗头", "收拾书包", "充电", "准备明天穿的衣服", "查天气"].map((text) => ({
    id: createId(),
    text,
    done: false,
    createdAt: Date.now()
  }));
}

function savePlans() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.plans));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function loadWeather() {
  const cached = readJSON(WEATHER_KEY, null);
  if (cached && Date.now() - cached.savedAt < WEATHER_CACHE_MS) {
    els.weatherLine.textContent = cached.text;
    return;
  }
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=34.426&longitude=132.743&current=temperature_2m,weather_code,precipitation,rain,showers&timezone=Asia%2FTokyo";
    const response = await fetch(url);
    if (!response.ok) throw new Error("weather request failed");
    const data = await response.json();
    const current = data.current;
    const code = Number(current.weather_code);
    const precipitation = Number(current.precipitation || 0) + Number(current.rain || 0) + Number(current.showers || 0);
    const needsUmbrella = precipitation > 0 || isRainCode(code);
    const text = `东广岛 ${Math.round(current.temperature_2m)}℃ ${weatherText(code)}  ${needsUmbrella ? "☂ 带伞" : "无需带伞"}`;
    localStorage.setItem(WEATHER_KEY, JSON.stringify({ savedAt: Date.now(), text }));
    els.weatherLine.textContent = text;
  } catch {
    els.weatherLine.textContent = "天气暂时不可用";
  }
}

function weatherText(code) {
  if ([0].includes(code)) return "晴";
  if ([1, 2].includes(code)) return "多云";
  if ([3].includes(code)) return "阴";
  if ([45, 48].includes(code)) return "有雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "小雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷雨";
  return "天气";
}

function isRainCode(code) {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function getRelativeDateKey(key, offset) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + offset);
  return formatDateKey(date);
}

function formatDateLabel(date, key) {
  const todayKey = formatDateKey(new Date());
  const prefix = key === todayKey ? "今天" : key > todayKey ? "编辑" : "查看";
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  return key === todayKey ? `${prefix} · ${dateText} ${weekday}` : `${prefix} ${dateText} ${weekday}`;
}

function sortTasks(a, b) {
  return (a.time || "99:99").localeCompare(b.time || "99:99") || a.createdAt - b.createdAt;
}

function normalizeTime(value) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function templateToText(template) {
  return template.map((task) => `${task.time} ${task.text}`).join("\n");
}

function parseTemplateText(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      const time = match ? normalizeTime(match[1]) : "";
      const text = match ? match[2].trim() : line;
      return {
        time: time || "09:00",
        text,
        category: inferCategory(text),
        important: /复习|学习|兼职|材料|背书|考试/.test(text)
      };
    });
}

function inferCategory(text) {
  if (/铁剂|维生素|D3|复合/.test(text)) return "补充剂";
  if (/复习|学习|背书|考试/.test(text)) return "学习";
  if (/兼职/.test(text)) return "兼职";
  if (/材料|申请/.test(text)) return "申请材料";
  if (/睡觉|休息/.test(text)) return "休息";
  return "生活";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}
