class scrapping {

    autoScroll = async (page) => {
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    optimizationWeb = async (page) => {
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (req.resourceType() === 'image' || req.resourceType() === 'media')
                req.abort();
            else
                req.continue();
        });
        await page.setDefaultNavigationTimeout(0) //dejamos en infinito el tiempo que puede tardar la pagina en cargar
        await page.setViewport({ width: 1920, height: 1080 })
    }
}
module.exports = scrapping;