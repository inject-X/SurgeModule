// ===== 基础工具 =====
const url = new URL($request.url);
const path = url.pathname;
const method = $request.method;

const DEBUG = true; // 🔥 调试开关（上线可改 false）
const log = (...args) => DEBUG && console.log("[Alcove]", ...args);

// ===== Mock 数据 =====
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

// ===== 路由表（类似后端 Controller）=====
const routes = {
    "GET /license/validate": {
        name: "Validate",
        response: license$,
        signature: "f89c5003528c3479e497b4c7851ed038ec0b420eef290cea8d01fe96cb9216fe"
    },
    "POST /license/activate": {
        name: "Activate",
        response: license$,
        signature: "f89c5003528c3479e497b4c7851ed038ec0b420eef290cea8d01fe96cb9216fe"
    }
};

// ===== 统一响应函数 =====
function send(response, signature) {
    return $done({
        status: 200,
        body: JSON.stringify(response),
        headers: {
            "Content-Type": "application/json",
            "x-signature": signature
        }
    });
}

// ===== 主逻辑 =====
(function handler() {
    try {
        log("====== 请求开始 ======");
        log("Method:", method);
        log("Path:", path);
        log("Full URL:", url.href);

        // 可选：打印请求头
        if (DEBUG && $request.headers) {
            log("Headers:", JSON.stringify($request.headers, null, 2));
        }

        // ===== 1️⃣ 处理 Trial（动态路径）=====
        if (path.startsWith("/trial/")) {
            log("✅ 命中 Trial 接口");

            return send(
                trial$,
                "9aa69091a2683c90186fd2e5f6c08b73332f786b4a9eb5fb8f87eac3889c3bc2"
            );
        }

        // ===== 2️⃣ 处理固定路由 =====
        const routeKey = `${method} ${path}`;
        const route = routes[routeKey];

        if (route) {
            log("✅ 命中:", route.name);

            return send(route.response, route.signature);
        }

        // ===== 3️⃣ 未匹配 =====
        log("❌ 未匹配任何接口:", routeKey);
        log("====== 请求结束（放行）======");

        $done({});
    } catch (err) {
        log("💥 脚本异常:", err);
        log(err.stack);

        $done({
            status: 500,
            body: JSON.stringify({
                error: "script_error",
                message: err.message
            })
        });
    }
})();
