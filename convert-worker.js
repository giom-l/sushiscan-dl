self.onmessage = async function(e) {
    try {
        const { imageData } = e.data;
        
        // Créer une blob à partir des données binaires
        const blob = new Blob([imageData], { type: 'image/webp' });
        
        // Créer une image bitmap depuis le blob
        const img = await createImageBitmap(blob);
        console.log("Image bitmap created:", img.width, "x", img.height);
        
        // Créer un canvas avec les dimensions de l'image
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        
        // Dessiner l'image sur le canvas
        ctx.drawImage(img, 0, 0);
        
        // Convertir en JPEG
        const jpegBlob = await canvas.convertToBlob({
            type: 'image/jpeg',
            quality: 0.8
        });
        
        // Convertir le blob en base64
        const reader = new FileReader();
        reader.readAsDataURL(jpegBlob);
        reader.onloadend = () => {
            self.postMessage({
                success: true,
                data: reader.result
            });
        };
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message
        });
    }
};