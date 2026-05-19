const fs = require('fs');
const vm = require('vm');

// Load engine.js
const engineCode = fs.readFileSync('c:\\Users\\박보경\\.gemini\\antigravity\\scratch\\study-planner\\engine.js', 'utf8');
const dataCode = fs.readFileSync('c:\\Users\\박보경\\.gemini\\antigravity\\scratch\\study-planner\\data.js', 'utf8');

const sandbox = {
    window: {},
    console: console,
    Date: Date,
    Math: Math,
    String: String,
    Array: Array,
    Object: Object,
    HOURS_PER_DIFF: { 1: 1.0, 2: 1.5, 3: 2.0, 4: 2.5, 5: 3.0 }
};
sandbox.window.HOURS_PER_DIFF = sandbox.HOURS_PER_DIFF;

vm.createContext(sandbox);
vm.runInContext(dataCode, sandbox);
vm.runInContext(engineCode, sandbox);

const Engine = sandbox.StudyEngine;

let engine = new Engine();
engine.state = {
    settings: {
        startDate: '2026-04-27',
        dailyHours: 5.5,
        dailyOverrides: {},
        taskDateOverrides: {},
        taskHoursOverrides: {},
        extraStudyDays: [],
        extraReviews: {}
    },
    progress: {},
    skippedDays: [],
    dailySpent: {},
    schedule: {},
    customTasks: []
};
engine.getTodayStr = () => '2026-04-27'; // Assume today is 27th

// Force a task to today (27th)
let forcedChapter = sandbox.window.subjectData.tax.chapters[5].id;
engine.state.settings.taskDateOverrides[forcedChapter] = ['2026-04-27'];

engine.generateSchedule();

console.log("Schedule for Today (27th):");
let todaySched = engine.getScheduleForDate('2026-04-27');
todaySched.forEach(t => console.log(`- [${t.subjectId}] ${t.chapter.title} (${t.allocated}h)`));

// Now simulate advancing to tomorrow (28th) without completing the forced task!
engine.getTodayStr = () => '2026-04-28';
engine.generateSchedule();

console.log("\nSchedule for Tomorrow (28th) after missing the forced task:");
let tomorrowSched = engine.getScheduleForDate('2026-04-28');
tomorrowSched.forEach(t => console.log(`- [${t.subjectId}] ${t.chapter.title} (${t.allocated}h)`));

