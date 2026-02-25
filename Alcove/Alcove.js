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
    started_at: "2099-12-31T00:00:00+01:00",
    active: true
};

const endpoints = [
    { pattern: /^https:\/\/api\.tryalcove\.com\/trial\/([A-F0-9-]+)$/i, response: trial$, signature: "12476fa503ed65e9ce88fc47c6d0b990380aa43787d2153a794f2a2b90558882"}, // Trial 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/validate$/i, response: license$, signature: "dd92f03c2e9e400e79a3eded5facd00982b76e9b0de7c86a9aa2ab1aa7d2a89b"}, // Validate 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/activate$/i, response: license$, signature: "dd92f03c2e9e400e79a3eded5facd00982b76e9b0de7c86a9aa2ab1aa7d2a89b"} // Validate 接口
];

let alcoveHandler = () => {
    try {
        console.log("Intercepted URL:", url);

        for (const endpoint of endpoints) {
            if (endpoint.pattern.test(url)) {
                console.log("Matched Endpoint:", endpoint.pattern);

                $done({
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
