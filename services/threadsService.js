import axios from "axios";

const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

/**
 * STEP 1: Create container
 */
const createContainer = async ({ text }) => {
  const res = await axios.post(
    `${THREADS_GRAPH_BASE}/${process.env.THREADS_USER_ID}/threads`,
    {
      media_type: "TEXT",
      text,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.THREADS_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.id;
};

/**
 * STEP 2: Publish container
 */
const publishContainer = async ({ creationId }) => {
  const res = await axios.post(
    `${THREADS_GRAPH_BASE}/${process.env.THREADS_USER_ID}/threads_publish`,
    {
      creation_id: creationId,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.THREADS_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data.id;
};

/**
 * MAIN SERVICE
 */
export const publishThreadsPost = async (text) => {
  const containerId = await createContainer({ text });
  return publishContainer({ creationId: containerId });
};
