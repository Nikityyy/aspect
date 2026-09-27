const RUN_KEY='aspect-active-v1'; const HISTORY_KEY='aspect-history-v1';
export function hasStorage(){try{const key='aspect-storage-check';localStorage.setItem(key,'1');localStorage.removeItem(key);return true;}catch{return false;}}
export function readRun(){try{return JSON.parse(localStorage.getItem(RUN_KEY)||'null');}catch{return null;}}
export function saveRun(run){try{localStorage.setItem(RUN_KEY,JSON.stringify(run));return true;}catch{return false;}}
export function removeRun(){try{localStorage.removeItem(RUN_KEY);return true;}catch{return false;}}
export function readHistory(){try{const value=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
export function saveHistory(result){try{const history=readHistory().filter(entry=>entry.id!==result.id);history.unshift(result);localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(0,20)));return true;}catch{return false;}}
export function removeHistory(id){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(readHistory().filter(entry=>entry.id!==id)));return true;}catch{return false;}}
export function clearLocalData(){try{localStorage.removeItem(RUN_KEY);localStorage.removeItem(HISTORY_KEY);localStorage.removeItem('aspect-language');return true;}catch{return false;}}
