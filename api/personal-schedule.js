export default async function handler(req, res) {
    const scriptUrl = process.env.PERSONAL_SCHEDULE_SCRIPT_URL;

    if (!scriptUrl) {
        return res.status(500).json({
            success: false,
            message: "PERSONAL_SCHEDULE_SCRIPT_URL is not configured",
        });
    }

    try {
        if (req.method === "GET") {
            const response = await fetch(`${scriptUrl}?type=personal`, {
                method: "GET",
                redirect: "follow",
            });

            const text = await response.text();

            try {
                return res.status(200).json(JSON.parse(text));
            } catch {
                return res.status(200).send(text);
            }
        }

        if (req.method === "POST") {
            const response = await fetch(scriptUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                },
                body: JSON.stringify(req.body),
                redirect: "follow",
            });

            const text = await response.text();

            try {
                return res.status(200).json(JSON.parse(text));
            } catch {
                return res.status(200).send(text);
            }
        }

        return res.status(405).json({
            success: false,
            message: "Method not allowed",
        });
    } catch (error) {
        console.error("[personal-schedule proxy]", error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}