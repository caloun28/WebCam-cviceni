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

        if (images.length === 0) {
            alert("Musíš přidat alespoň 1 fotku");
            return;
        }

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


});