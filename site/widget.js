const search = document.querySelector("#search");
const status = document.querySelector("#status");

function churchPopup(church) {
  const popup = document.createElement("div");
  popup.className = "church-popup";
  const name = document.createElement("strong");
  name.textContent = church.name;
  const address = document.createElement("p");
  address.textContent = church.address;
  popup.append(name, address);
  if (church.approximate) {
    const note = document.createElement("p");
    note.textContent = "Approximate pin. Confirm the location before visiting.";
    popup.append(note);
  }
  if (church.geocoding_attribution) {
    const credit = document.createElement("small");
    credit.textContent = church.geocoding_attribution;
    popup.append(credit);
  }

  if (/^https?:\/\//i.test(church.website || "")) {
    const website = document.createElement("a");
    website.href = church.website;
    website.target = "_blank";
    website.rel = "noopener noreferrer";
    website.textContent = "Church website";
    popup.append(website);
  }
  return popup;
}

async function start() {
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const response = await fetch(preview ? "churches.sample.json" : "churches.live.json");
  if (!response.ok) throw new Error("Location feed unavailable");
  const churches = await response.json();
  const map = L.map("map", { scrollWheelZoom: true }).setView([20, 0], 2);
  const mapElement = map.getContainer();
  mapElement.addEventListener("wheel", event => {
    if (event.deltaY || !event.wheelDeltaY) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Some mouse drivers report vertical movement only in the legacy wheel field.
    mapElement.dispatchEvent(new WheelEvent("wheel", {
      deltaY: -event.wheelDeltaY,
      clientX: event.clientX,
      clientY: event.clientY,
      cancelable: true,
    }));
  }, { capture: true, passive: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  if (churches.some(church => church.geocoding_attribution)) {
    map.attributionControl.addAttribution('Geocoding by <a href="https://www.geoapify.com/">Geoapify</a>');
  }

  const locations = churches.map(church => ({
    text: (church.name + " " + church.address).toLowerCase(),
    marker: L.marker([church.lat, church.lng], {
      title: church.name,
      alt: church.name,
    }).bindPopup(() => churchPopup(church)),
  }));
  const markers = L.markerClusterGroup({ showCoverageOnHover: false }).addTo(map);

  function render() {
    const query = search.value.trim().toLowerCase();
    const visibleMarkers = [];
    for (const { text, marker } of locations) {
      if (text.includes(query)) visibleMarkers.push(marker);
    }
    markers.clearLayers().addLayers(visibleMarkers);
    const count = visibleMarkers.length;
    if (count) map.fitBounds(markers.getBounds(), { padding: [30, 30], maxZoom: 14 });
    status.textContent = (preview ? "Sample data · " : "") +
      (count ? count + (count === 1 ? " church" : " churches") : "No churches found");
  }

  search.disabled = false;
  search.addEventListener("input", render);
  render();
}

start().catch(() => {
  status.textContent = "The church map is currently unavailable.";
});
