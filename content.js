function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const imagesUrl = async () => {
    let ans = new Array();
    let imgs = document.getElementsByClassName("ts-main-image");
    let url = imgs[0].src;
    let name = url.split("/").pop().split("-")[0];
    if ("-001.jpg" !== url.slice(-8)) {
        throw "The first image should end with -001.jpg";
    }
    for (let i = 1; i < imgs.length + 1; i++) {
        let newUrl = url.slice(0, -7) + ("00" + i).slice(-3) + ".jpg";
        ans.push(newUrl);
    }
    return { name: name, urls: ans };
};
const download = async () => {
    const imgs = new Array();
    const { name, urls } = await imagesUrl();
    for (const url of urls) {
        var img = new Image();
        img.loaded = new Promise((resolve) => {
            img.onload = resolve;
        });
        img.src = url;
        imgs.push(img);
    }

    var doc = new jspdf.jsPDF({
        orientation: "p",
        unit: "px",
        format: "a4",
        compress: true,
    });
    doc = doc.deletePage(1);
    for (const img of imgs) {
        await img.loaded;
        doc.addPage([img.width, img.height], "p");
        doc.addImage(img, "JPEG", 0, 0, img.width, img.height, "", "FAST");
    }

    var reader = new FileReader();
    reader.readAsDataURL(doc.output("blob"));
    reader.onloadend = function () {
        browser.runtime.sendMessage({
            dataURL: reader.result,
            name: name,
        });
    };
};

const addButton = () => {
    const toolbar = document.getElementsByClassName("chnav ctop")[0];

    let div = document.createElement("div");
    toolbar.insertBefore(div, toolbar.firstChild);
    div.innerHTML = "Download";
    div.onclick = download;
};
addButton();
