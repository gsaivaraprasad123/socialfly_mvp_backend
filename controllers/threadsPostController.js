import { publishThreadsPost } from "../services/threadsService.js";

/**
 * POST /threads/post
 * Body: { text: string }
 */
export const postNow = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const threadsPostId = await publishThreadsPost(text);

    return res.json({
      success: true,
      threadsPostId,
    });
  } catch (err) {
    console.error(
      "Threads post error:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      error:
        err.response?.data?.error?.message ||
        "Failed to post to Threads",
    });
  }
};
