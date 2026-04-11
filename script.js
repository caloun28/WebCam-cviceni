document.addEventListener('DOMContentLoaded', () => {

    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const photoElement = document.getElementById('photoElement');
    const startButton = document.getElementById('startButton');
    const captureButton = document.getElementById('captureButton');
    const clearButton = document.getElementById('clearButton');
    const fileInput = document.querySelector('.hidden-file-input');

    let stream;
    let capturedImage = "";
    async function startWebcam() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = stream;
            startButton.disabled = true;
            captureButton.disabled = false;
        } catch (error) {
            console.error('Error accessing webcam:', error);
        }
    }
    if (startButton) startButton.addEventListener('click', startWebcam);

    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    canvasElement.width = img.width;
                    canvasElement.height = img.height;

                    const ctx = canvasElement.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    canvasElement.style.display = "block";
                    videoElement.style.display = "none";

                    let dataUrl = canvasElement.toDataURL('image/jpeg', 0.9);
                    dataUrl = await compressImage(dataUrl, 2 * 1024 * 1024);

                    capturedImage = dataUrl;
                    fileInput.value = '';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (captureButton) {
        captureButton.addEventListener('click', async () => {

            if (!videoElement.videoWidth) {
                const originalText = captureButton.textContent;
                captureButton.textContent = "Zapněte kameru!";
                captureButton.style.backgroundColor = "#dc2626";
                setTimeout(() => {
                    captureButton.textContent = originalText;
                    captureButton.style.backgroundColor = "";
                }, 3000);
                return;
            }

            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;

            const ctx = canvasElement.getContext('2d');
            ctx.drawImage(videoElement, 0, 0);

            canvasElement.style.display = "block";
            videoElement.style.display = "none";

            let dataUrl = canvasElement.toDataURL('image/jpeg', 0.9);
            capturedImage = await compressImage(dataUrl, 2 * 1024 * 1024);
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            capturedImage = "";
            canvasElement.style.display = "none";
            videoElement.style.display = "block";
        });
    }

    async function compressImage(dataUrl, maxSize) {
        let quality = 0.9;
        while (getSize(dataUrl) > maxSize && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvasElement.toDataURL('image/jpeg', quality);
        }
        return dataUrl;
    }

    function getSize(base64) {
        return Math.round((base64.length * 3) / 4);
    }

    function getGPS() {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition((pos) => {
                resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`);
            }, () => resolve(null));
        });
    }

    const incidentForm = document.getElementById("incidentForm");
    if (incidentForm) {
        incidentForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const reporterName = document.getElementById("reporterName").value;
            const reporterEmail = document.getElementById("reporterEmail").value;
            const category = document.getElementById("category").value;
            const location = document.getElementById("location").value;
            const description = document.getElementById("description").value;

            const submitBtn = incidentForm.querySelector('button[type="submit"]');

            const gps = await getGPS();

            if (description.length < 10) {
                if (submitBtn) {
                    const originalText = submitBtn.textContent;
                    submitBtn.textContent = "Popis je moc krátký!";
                    submitBtn.style.backgroundColor = "#dc2626";
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.backgroundColor = "";
                    }, 3000);
                }
                return;
            }

            const fallbackImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

            const body = {
                reporterName,
                reporterEmail,
                category,
                location,
                description,
                gps,
                imageBase64: capturedImage || fallbackImage
            };

            try {
                const res = await fetch("http://wa3lm.dev.spsejecna.net/incident/api.php", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body)
                });

                const data = await res.json();
                console.log(data);


                if (submitBtn) {
                    const originalText = submitBtn.textContent;
                    submitBtn.textContent = "✔ Odesláno!";
                    submitBtn.style.backgroundColor = "#16a34a";
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.backgroundColor = "";
                    }, 3000);
                }
                if (typeof window.loadOperatorData === 'function') window.loadOperatorData();

            } catch (err) {
                console.error("Chyba při odesílání:", err);
                if (submitBtn) {
                    const originalText = submitBtn.textContent;
                    submitBtn.textContent = "Chyba při odesílání!";
                    submitBtn.style.backgroundColor = "#dc2626";
                    setTimeout(() => {
                        submitBtn.textContent = originalText;
                        submitBtn.style.backgroundColor = "";
                    }, 3000);
                }
            }

            capturedImage = "";
            canvasElement.style.display = "none";
            videoElement.style.display = "block";
            incidentForm.reset();
        });
    }

    const mapElement = document.getElementById('map');

    if (mapElement) {
        const map = L.map('map').setView([49.8, 15.5], 7);
        L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        let incidentMarkers = L.layerGroup().addTo(map);
        let allIncidents = [];

        const searchInput = document.getElementById('operatorSearch');
        const datalist = document.getElementById('searchSuggestions');
        const tableBody = document.querySelector('#incidentsTable tbody');

        const filterCategory = document.getElementById('filterCategory');
        const filterLocation = document.getElementById('filterLocation');
        const filterDateFrom = document.getElementById('filterDateFrom');
        const saveFiltersBtn = document.getElementById('saveFiltersBtn');
        const clearFiltersBtn = document.getElementById('clearFiltersBtn');

        function loadFilters() {
            const savedFilters = JSON.parse(localStorage.getItem('operatorFilters')) || {};
            if (filterCategory) filterCategory.value = savedFilters.category || '';
            if (filterLocation) filterLocation.value = savedFilters.location || '';
            if (filterDateFrom) filterDateFrom.value = savedFilters.dateFrom || '';
            return savedFilters;
        }

        function saveFilters() {
            const filters = {
                category: filterCategory ? filterCategory.value.trim() : '',
                location: filterLocation ? filterLocation.value.trim() : '',
                dateFrom: filterDateFrom ? filterDateFrom.value : ''
            };
            localStorage.setItem('operatorFilters', JSON.stringify(filters));
            applyFiltersAndRender();
        }

        function applyFiltersAndRender() {
            const filters = loadFilters();
            let filteredData = allIncidents;

            if (filters.category) {
                filteredData = filteredData.filter(i => i.category && i.category.toLowerCase().includes(filters.category.toLowerCase()));
            }
            if (filters.location) {
                filteredData = filteredData.filter(i => i.location && i.location.toLowerCase().includes(filters.location.toLowerCase()));
            }
            if (filters.dateFrom) {
                filteredData = filteredData.filter(i => i.created_at && i.created_at >= filters.dateFrom);
            }

            const quickQuery = searchInput ? searchInput.value.toLowerCase() : '';
            if (quickQuery) {
                filteredData = filteredData.filter(item => {
                    return (
                        (item.reporter_name && item.reporter_name.toLowerCase().includes(quickQuery)) ||
                        (item.location && item.location.toLowerCase().includes(quickQuery)) ||
                        (item.created_at && item.created_at.toLowerCase().includes(quickQuery)) ||
                        (item.category && item.category.toLowerCase().includes(quickQuery))
                    );
                });
            }

            renderData(filteredData);
        }

        if (saveFiltersBtn) saveFiltersBtn.addEventListener('click', saveFilters);
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                localStorage.removeItem('operatorFilters');
                loadFilters();
                applyFiltersAndRender();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', applyFiltersAndRender);
        }

        function renderData(dataArray) {
            if (!tableBody) return;
            tableBody.innerHTML = '';
            incidentMarkers.clearLayers();

            dataArray.forEach(incident => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${incident.id}</td>
                    <td>${incident.reporter_name}</td>
                    <td>${incident.category}</td>
                    <td>${incident.location || '-'}</td>
                    <td>${incident.created_at}</td>
                `;
                tableBody.appendChild(tr);

                if (incident.gps) {
                    const coords = incident.gps.split(',');
                    if (coords.length === 2) {
                        const lat = parseFloat(coords[0].trim());
                        const lng = parseFloat(coords[1].trim());

                        if (!isNaN(lat) && !isNaN(lng)) {
                            L.marker([lat, lng])
                                .bindPopup(`<b>${incident.category}</b><br>${incident.reporter_name}<br>${incident.location || ''}`)
                                .addTo(incidentMarkers);
                        }
                    }
                }
            });
        }

        function buildDatalist(dataArray) {
            if (!datalist) return;
            const suggestions = new Set();

            dataArray.forEach(incident => {
                if (incident.reporter_name) suggestions.add(incident.reporter_name);
                if (incident.category) suggestions.add(incident.category);
                if (incident.location) suggestions.add(incident.location);
                if (incident.created_at) suggestions.add(incident.created_at);
            });

            datalist.innerHTML = '';
            suggestions.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                datalist.appendChild(option);
            });
        }

        async function loadOperatorData() {
            try {
                const response = await fetch("http://wa3lm.dev.spsejecna.net/incident/select.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        "select": ["id", "reporter_name", "category", "location", "created_at", "gps"],
                        "orderBy": { "column": "created_at", "direction": "DESC" },
                        "limit": 100
                    })
                });

                const rawData = await response.json();

                if (rawData && rawData.success === true && Array.isArray(rawData.data)) {
                    allIncidents = rawData.data;
                } else {
                    allIncidents = [];
                }

                buildDatalist(allIncidents);
                loadFilters();
                applyFiltersAndRender();

            } catch (err) {
                console.error("Chyba při načítání dat operátora:", err);
            }
        }

        loadOperatorData();

        setInterval(loadOperatorData, 30000);
    }
});