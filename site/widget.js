const search = document.querySelector("#search");
const suggestions = document.querySelector("#suggestions");
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
  if (/^https?:\/\//i.test(church.website || "")) {
    const website = document.createElement("a");
    website.href = church.website;
    website.target = "_blank";
    website.rel = "noopener noreferrer";
    website.textContent = "Church website";
    popup.append(website);
  }
  if (church.geocoding_attribution) {
    const credit = document.createElement("small");
    credit.textContent = church.geocoding_attribution;
    popup.append(credit);
  }
  return popup;
}

async function start() {
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const response = await fetch(preview ? "churches.sample.json" : "churches.live.json");
  if (!response.ok) throw new Error("Location feed unavailable");
  const churches = await response.json();
  const map = L.map("map", { scrollWheelZoom: true, minZoom: 1, maxZoom: 19 }).setView([20, 0], 2);
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
  addBasemap(map).catch(error => {
    console.warn("The map background could not be loaded.", error);
  });
  if (churches.some(church => church.geocoding_attribution)) {
    map.attributionControl.addAttribution('Geocoding by <a href="https://www.geoapify.com/">Geoapify</a>');
  }

  const locations = churches.map(church => ({
    church,
    text: (church.name + " " + church.address).toLowerCase(),
    marker: L.marker([church.lat, church.lng], {
      title: church.name,
      alt: church.name,
    }).bindPopup(() => churchPopup(church)),
  }));
  const markers = L.markerClusterGroup({ showCoverageOnHover: false }).addTo(map);
  let options = [];
  let activeOption = -1;

  function showMarkers(matches, fit = true) {
    markers.clearLayers().addLayers(matches.map(location => location.marker));
    const count = matches.length;
    if (count && fit) map.fitBounds(markers.getBounds(), { padding: [30, 30], maxZoom: 14 });
    status.textContent = (preview ? "Sample data · " : "") +
      (count ? count + (count === 1 ? " church" : " churches") : "No churches found");
  }

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
    activeOption = -1;
  }

  function select(location) {
    search.value = location.church.name;
    options = [location];
    closeSuggestions();
    showMarkers(options, false);
    map.setView(location.marker.getLatLng(), 15, { animate: false });
    markers.zoomToShowLayer(location.marker, () => location.marker.openPopup());
  }

  function openSuggestions() {
    closeSuggestions();
    if (!options.length) return;
    options.forEach((location, index) => {
      const option = document.createElement("li");
      option.id = "church-suggestion-" + index;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const name = document.createElement("strong");
      name.textContent = location.church.name;
      const address = document.createElement("small");
      address.textContent = location.church.address;
      option.append(name, address);
      option.addEventListener("mousedown", event => event.preventDefault());
      option.addEventListener("click", () => select(location));
      suggestions.append(option);
    });
    suggestions.hidden = false;
    search.setAttribute("aria-expanded", "true");
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const matches = query ? locations.filter(location => location.text.includes(query)) : locations;
    options = query ? matches.slice(0, 8) : [];
    showMarkers(matches);
    openSuggestions();
  }

  search.disabled = false;
  search.addEventListener("input", render);
  search.addEventListener("focus", openSuggestions);
  search.addEventListener("blur", closeSuggestions);
  search.addEventListener("keydown", event => {
    if (event.key === "Escape" && !suggestions.hidden) {
      event.preventDefault();
      closeSuggestions();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
      event.preventDefault();
      if (suggestions.hidden) openSuggestions();
      if (activeOption >= 0) suggestions.children[activeOption].setAttribute("aria-selected", "false");
      const offset = event.key === "ArrowDown" ? 1 : -1;
      activeOption = activeOption < 0 && offset < 0 ? options.length - 1 :
        (activeOption + offset + options.length) % options.length;
      const option = suggestions.children[activeOption];
      option.setAttribute("aria-selected", "true");
      search.setAttribute("aria-activedescendant", option.id);
      option.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && activeOption >= 0) {
      event.preventDefault();
      select(options[activeOption]);
    }
  });
  render();
}

async function addBasemap(map) {
  const response = await fetch("https://tiles.openfreemap.org/styles/positron");
  if (!response.ok) throw new Error("Basemap style unavailable");
  const style = await response.json();
  const hiddenLayers = new Set([
    "park", "landcover_ice_shelf", "landcover_glacier", "landcover_wood",
    "waterway_line_label", "water_name_point_label", "water_name_line_label",
  ]);
  style.layers = style.layers.filter(layer => !hiddenLayers.has(layer.id));
  L.maplibreGL({ style, interactive: false, pane: "tilePane" }).addTo(map);
}

start().catch(() => {
  status.textContent = "The church map is currently unavailable.";
});
