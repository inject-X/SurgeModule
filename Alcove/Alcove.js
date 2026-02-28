let url = $request.url;

const license$ = {
    key: "88888888-8888-8888-8888-888888888888",
    active: true,
    beta: false,
    name: "InjectX-Team",
    email: "injectxteam@gmail.com",
    limit: 999,
    usage: 1,
    instance: {
        id: "35787161-5114-5772-bbdb-cb2821d339d9",
        name: "InjectX",
        model: "team@injectx.com"
    }
};

const trial$ = {
    uuid: "35787161-5114-5772-bbdb-cb2821d339d9",
    started_at: "2026-02-24T03:36:32+01:00",
    ends_at: "2099-12-31T00:00:00+01:00",
    active: true
};

const endpoints = [
    { pattern: /^https:\/\/api\.tryalcove\.com\/trial\/([A-F0-9-]+)$/i, response: trial$, signature: "2e1271ac21ee84a5db213ca31870076161472551207db839341b63886fac5e6c"}, // Trial 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/validate$/i, response: license$, signature: "a6c953ccbba493badefc93b475acffa92f506d67b25ce3f0ca83192353d30f17"}, // Validate 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/activate$/i, response: license$, signature: "a6c953ccbba493badefc93b475acffa92f506d67b25ce3f0ca83192353d30f17"} // Validate 接口
];

let alcoveHandler = () => {
    try {
        console.log("Intercepted URL:", url);

        for (const endpoint of endpoints) {
            if (endpoint.pattern.test(url)) {
                console.log("Matched Endpoint:", endpoint.pattern);

                $done({
                    status: 200,
                    body: JSON.stringify(endpoint.response),
                    headers: {
                        ...$response?.headers,
                        "x-signature": endpoint.signature
                    }
                });
                return;
            }
        }

        $done({});
    } catch (err) {
        console.error("Error in handler:", err);
        $done({});
    }
};

alcoveHandler();
