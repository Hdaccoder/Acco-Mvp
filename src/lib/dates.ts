export const LONDON_TZ = "Europe/London"; // Display convenience
export const nightKey = (d = new Date()) => {
// Night runs 05:00 -> 04:59 next day
const dt = new Date(d);
const hour = dt.getHours();
if (hour < 5) {
dt.setDate(dt.getDate() - 1);
}
const y = dt.getFullYear();
const m = String(dt.getMonth() + 1).padStart(2, "0");
const day = String(dt.getDate()).padStart(2, "0");
return `${y}${m}${day}`;
};