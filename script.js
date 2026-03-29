document.addEventListener('DOMContentLoaded', () => {

    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const photoElement = document.getElementById('photoElement');
    const startButton = document.getElementById('startButton');
    const captureButton = document.getElementById('captureButton');
    const clearButton = document.getElementById('clearButton');
    const fileInput = document.querySelector('.hidden-file-input');

    let stream;
    let images = [];
    const maxImages = 3;

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
    startButton.addEventListener('click', startWebcam);

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (images.length >= maxImages) {
            alert("Maximálně 3 fotky");
            fileInput.value = '';
            return;
        }

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

                images.push(dataUrl);


                fileInput.value = '';
            };
            img.src = e.target.result;
        };


        reader.readAsDataURL(file);
    });


    captureButton.addEventListener('click', async () => {
        if (images.length >= maxImages) {
            alert("Maximalne 3 fotky");
            return;
        }

        if (!videoElement.videoWidth) {
            alert("Počkej než se načte kamera");
            return;
        }

        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        const ctx = canvasElement.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);


        canvasElement.style.display = "block";
        videoElement.style.display = "none";

        let dataUrl = canvasElement.toDataURL('image/jpeg', 0.9);
        dataUrl = await compressImage(dataUrl, 2 * 1024 * 1024);

        images.push(dataUrl);
    });

    clearButton.addEventListener('click', () => {
        images = [];

        canvasElement.style.display = "none";
        videoElement.style.display = "block";

        alert("Fotky smazany");
    });

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
            }, () => resolve(null)
            );
        });
    }

    document.getElementById("incidentForm").addEventListener("submit", async (e) => {
        e.preventDefault();


        const reporterName = document.getElementById("reporterName").value;
        const reporterEmail = document.getElementById("reporterEmail").value;
        const category = document.getElementById("category").value;
        const location = document.getElementById("location").value;
        const description = document.getElementById("description").value;

        const gps = await getGPS();

        if (description.length < 10) {
            alert("Popis musí mít alespoň 10 znaků");
            return;
        }

        for (let img of images) {
            const body = {
                reporterName,
                reporterEmail,
                category,
                location,
                description,
                gps,
                imageBase64: img
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

            } catch (err) {
                console.error("Chyba při odesílání:", err);
            }
        }

        alert("Odesláno!");
        images = [];
    });

    const mapElement = document.getElementById('map');

    if (mapElement) {
        // Nastavení mapy
        const map = L.map('map').setView([49.8, 15.5], 7);
        L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        let incidentMarkers = L.layerGroup().addTo(map);
        let allIncidents = [];

        const searchInput = document.getElementById('operatorSearch');
        const datalist = document.getElementById('searchSuggestions');
        const tableBody = document.querySelector('#incidentsTable tbody');

        // Funkce 1: Vykreslení dat (tabulka + mapa) - MUSÍ BÝT DEFINOVÁNA ZDE
        function renderData(dataArray) {
            if (!tableBody) return;
            tableBody.innerHTML = '';
            incidentMarkers.clearLayers();

            dataArray.forEach(incident => {
                // Přidání do tabulky
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${incident.id}</td>
                    <td>${incident.reporter_name}</td>
                    <td>${incident.category}</td>
                    <td>${incident.location || '-'}</td>
                    <td>${incident.created_at}</td>
                `;
                tableBody.appendChild(tr);

                // Přidání na mapu
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

        // Funkce 2: Sestavení našeptávače (ZDE JSEM ODEBRAL ČASY PRO PŘEHLEDNOST)
        function buildDatalist(dataArray) {
            if (!datalist) return;
            const suggestions = new Set();

            dataArray.forEach(incident => {
                if (incident.reporter_name) suggestions.add(incident.reporter_name);
                if (incident.category) suggestions.add(incident.category);
                if (incident.location) suggestions.add(incident.location);
                // Časy už do našeptávače nepřidáváme
            });

            datalist.innerHTML = '';
            suggestions.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                datalist.appendChild(option);
            });
        }

        // Funkce 3: Načtení dat z API
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
                renderData(allIncidents); // Zde se volá funkce renderData

            } catch (err) {
                console.error("Chyba při načítání dat operátora:", err);
            }
        }

        // 4. Filtrace (když uživatel píše do pole)
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();

                const filteredData = allIncidents.filter(item => {
                    return (
                        (item.reporter_name && item.reporter_name.toLowerCase().includes(query)) ||
                        (item.location && item.location.toLowerCase().includes(query)) ||
                        (item.created_at && item.created_at.toLowerCase().includes(query)) ||
                        (item.category && item.category.toLowerCase().includes(query))
                    );
                });

                renderData(filteredData); // Zde se znovu volá funkce renderData
            });
        }

        // 5. Spuštění na začátku
        loadOperatorData();
    }

});