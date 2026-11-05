const destinations = {
  "start": "index.html",
  "group-route": "group-guidance.html",
  "manual-1": "step-1.html",
  "part1": "step-1.html",
  "step-1.1": "step-1.html",
  "step-1.2": "step-1.html",
  "step-1.3": "step-1.html",
  "manual-2": "step-2.html",
  "step-2.1": "step-2.html",
  "step-2.2": "step-2.html",
  "step-2.3": "step-2.html",
  "step-2.4": "step-2.html",
  "step-2.5": "step-2.html",
  "step-2.6": "step-2.html",
  "step-2.7": "step-2.html",
  "manual-3": "step-3.html",
  "part2": "step-3.html",
  "step-3.0": "step-3.html",
  "step-3.1": "step-3.html",
  "step-3.1.1": "step-3.html",
  "step-3.1.2": "step-3.html",
  "step-3.1.3": "step-3.html",
  "step-3.2": "step-3.html",
  "step-3.2.1": "step-3.html",
  "step-3.2.2": "step-3.html",
  "step-3.2.3": "step-3.html",
  "step-3.3": "step-3.html",
  "step-3.3.1": "step-3.html",
  "step-3.3.2": "step-3.html",
  "step-3.3.3": "step-3.html",
  "step-3.3.4": "step-3.html",
  "step-3.3.5": "step-3.html",
  "step-3.3.6": "step-3.html",
  "manual-4": "step-4.html",
  "step-4.1": "step-4.html",
  "step-4.2": "step-4.html",
  "step-4.3": "step-4.html",
  "step-4.4": "step-4.html",
  "step-4.4.1": "step-4.html",
  "step-4.4.2": "step-4.html",
  "step-4.4.3": "step-4.html",
  "step-4.5": "step-4.html",
  "step-4.6": "step-4.html",
  "step-4.7": "step-4.html",
  "step-4.8": "step-4.html",
  "downloads": "downloads.html"
};
function followWorkshopLink() {
  const anchor = window.location.hash.slice(1);
  const destination = destinations[anchor];
  if (destination && destination !== "index.html") {
    window.location.replace(destination + window.location.hash);
  }
}
followWorkshopLink();
window.addEventListener("hashchange", followWorkshopLink);
