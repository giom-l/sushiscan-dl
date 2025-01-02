function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const pad = (num, size) => {
    return String(num).padStart(size, '0');
}

const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const getImageType = (url) => {
    const extension = url.split('.').pop().toLowerCase();
    const formats = {
        'webp': 'WEBP',
        'jpg': 'JPEG',
        'jpeg': 'JPEG'
    };
    return formats[extension] || 'JPEG';
};

// init conversion worker

let conversionWorker = null;
const getConversionWorker = () => {
    if (!conversionWorker) {
        conversionWorker = new Worker(browser.runtime.getURL('convert-worker.js'));
    }
    return conversionWorker;
};

const convertToJpeg = (imageData) => {
    return new Promise((resolve, reject) => {
        const worker = getConversionWorker();
        
        worker.onmessage = (e) => {
            if (e.data.success) {
                resolve(e.data.data);
            } else {
                reject(new Error(e.data.error));
            }
        };
        
        worker.onerror = reject;
        
        worker.postMessage({
            imageData,
            type: 'image/webp'
        });
    });
};

const getBinaryData = (url) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                console.log(`Binary data loaded: ${formatFileSize(xhr.response.byteLength)}`);
                resolve(xhr.response);
            } else {
                reject(new Error('Failed to load image'));
            }
        };
        
        xhr.onerror = () => reject(new Error('XHR request failed'));
        xhr.send();
    });
};

const findLoadedImage = (url) => {
    return new Promise((resolve) => {
        console.log("\nLooking for image:", url);
        
        // Find exact match with url
        const exactMatch = document.querySelector(`img[src="${url}"]`);
        if (exactMatch && exactMatch.complete) {
            console.log("✓ Found by exact URL match, dimensions:", exactMatch.width, "x", exactMatch.height);
            resolve(exactMatch);
            return;
        }
        
        // otherwise we could look for data-src or index but we'll need to reload the image in any case.
		// So let's directly go to reload image (which is also done by the website when you scroll)
        //const dataSrcMatch = document.querySelector(`img[data-src="${url}"]`);
        //if (dataSrcMatch) {
        //    console.log("Found by data-src, loading full image...");
            // Forcer le chargement complet
        //    const img = new Image();
        //    img.onload = () => {
        //        console.log("✓ Image loaded from data-src:", img.width, "x", img.height);
        //        resolve(img);
        //    };
        //    img.src = url;
        //    return;
        //}
        // Search with index
        // const pageNumber = parseInt(url.match(/(\d+)\.webp$/)[1]);
        // const indexMatch = document.querySelector(`img.ts-main-image[data-index="${pageNumber-1}"]`);
        // if (indexMatch && indexMatch.complete) {
        //     console.log("✓ Found by index match");
        //     resolve(indexMatch);
        //     return;
        // }
		
        console.log("✗ Image not found in DOM, loading...");
        const img = new Image();
        img.onload = () => {
            console.log("Image loaded with dimensions:", img.width, "x", img.height);
            resolve(img);
        };
        img.src = url;
    });
};

const addImageToPdf = async (doc, url, existingDimensions = null) => {
    try {
        console.log("Processing image:", url);
        
        // Get binary data
        const binaryData = await getBinaryData(url);
        
        // In case of webp, let's convert it to jpeg.
		// webp is better defined but when we convert it to PDF, the resulting file size increase a lot (x3 for the one I tested)
		// Since I'm more interested in reducing size (and since it remains readable on my Kindle...), let's do it
        const imageType = getImageType(url);
        if (imageType === 'WEBP') {
            console.log('Converting WebP to JPEG...');
            const jpegData = await convertToJpeg(binaryData);
            console.log('Conversion complete');
            
            // Load the converted image to get its dimensions (keep the original one may lead to undesired cropping)
            /*const convertedImg = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = jpegData;
            });
            */
            // Scale to reduce resulting file size
            /*const scale = 0.75;
            //const width = Math.floor(convertedImg.width * scale);
            //const height = Math.floor(convertedImg.height * scale);
			const width = Math.floor(existingDimensions.width * scale);
            const height = Math.floor(existingDimensions.height * scale);
            */
			
            // Add to PDF
            // doc.addPage([width, height], "p");
            //doc.addImage(jpegData, 'JPEG', 0, 0, width, height, undefined, 'FAST');
			doc.addPage([existingDimensions.width, existingDimensions.height], "p");
			doc.addImage(jpegData, 'JPEG', 0, 0, existingDimensions.width, existingDimensions.height, undefined, 'FAST');
        } else {
            // For non webp images
            const base64 = btoa(
                new Uint8Array(binaryData)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            const dataUrl = `data:image/${imageType.toLowerCase()};base64,${base64}`;
            
			/*
            const scale = 0.75;
            const width = Math.floor(existingDimensions.width * scale);
            const height = Math.floor(existingDimensions.height * scale);
			*/
			
            // doc.addPage([width, height], "p");
            //doc.addImage(dataUrl, imageType, 0, 0, width, height, undefined, 'FAST');
			doc.addPage([existingDimensions.width, existingDimensions.height], "p");
			doc.addImage(dataUrl, imageType, 0, 0, existingDimensions.width, existingDimensions.height, undefined, 'FAST');
        }
        
        console.log("Image added to PDF successfully");
        
    } catch (error) {
        console.error("Error adding image:", error);
        throw error;
    }
};

const getImagesUrl = async () => {
    let ans = new Array();
    let imgs = document.getElementsByClassName("ts-main-image");
    let url = imgs[0].src;
    let name = url.split("/").pop().split("-")[0];
    
	const ext = url.includes('.') ? url.split('.').pop().toLowerCase() : '';
	const extLength = ext ? -(ext.length + 4) : 0;  // +4 stands for 3 digits for page + dot
	const base = url.slice(0, extLength || undefined);
    for (let i = 1; i < imgs.length + 1; i++) {
        let newUrl = `${base}${pad(i,3)}.${ext}`;
        ans.push(newUrl);
    }
    return { name: name, urls: ans };
};

const processBatch = async (images, doc) => {
    let processedCount = 0;
    const totalImages = images.length;

    for (const url of images) {
        try {
            processedCount++;
            console.log(`Processing image ${processedCount}/${totalImages}`);
            
            // Try to load the image wherever it can be found and reload it if necessary
            const img = await findLoadedImage(url);
            const dimensions = {
                width: img.width,
                height: img.height
            };
            
            await addImageToPdf(doc, url, dimensions);
            await sleep(50);
            
        } catch (error) {
            console.error("Error processing image:", url);
            console.error("Error details:", error);
            throw error;
        }
    }
    console.log("All images processed successfully!");
};

const download = async () => {
    try {
        const { name, urls } = await getImagesUrl();
        console.log(`Starting download of ${urls.length} images`);
        
        var doc = new jspdf.jsPDF({
            orientation: "p",
            unit: "px",
            format: "a4",
            compress: true,
            putOnlyUsedFonts: true,
            precision: 2
        });
        
        doc = doc.deletePage(1);
        
        const startTime = Date.now();
        
        try {
            await processBatch(urls, doc);
            
            console.log("Creating PDF...");
            const blob = doc.output("blob");
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`PDF created in ${duration} seconds, size: ${formatFileSize(blob.size)}`);
            
            var reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = function () {
                browser.runtime.sendMessage({
                    dataURL: reader.result,
                    name: name,
                });
                console.log("PDF sent for download");
            };
        } catch (error) {
            console.error("Processing stopped due to error:", error.message);
            return;
        }
    } catch (error) {
        console.error("Error during download:", error);
    }
};

const addButton = () => {
    const toolbar = document.getElementsByClassName("chnav ctop")[0];
    let div = document.createElement("div");
    toolbar.insertBefore(div, toolbar.firstChild);
    div.innerHTML = "Download";
    div.onclick = download;
};

addButton();