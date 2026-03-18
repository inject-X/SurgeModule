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
    { pattern: /^https:\/\/api\.tryalcove\.com\/trial\/([A-F0-9-]+)$/i, response: trial$, X-Device-Signature: "9aa69091a2683c90186fd2e5f6c08b73332f786b4a9eb5fb8f87eac3889c3bc2"}, // Trial 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/validate$/i, response: license$, X-Device-Signature: "f89c5003528c3479e497b4c7851ed038ec0b420eef290cea8d01fe96cb9216fe"}, // Validate 接口
    { pattern: /^https:\/\/api\.tryalcove\.com\/license\/activate$/i, response: license$, X-Device-Signature: "f89c5003528c3479e497b4c7851ed038ec0b420eef290cea8d01fe96cb9216fe"} // Validate 接口
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
