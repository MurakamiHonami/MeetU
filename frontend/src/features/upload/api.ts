import { client, putToStorage, unwrap } from "../../shared/api";

export const uploadApi = {
  uploadImage: async (thread: { matchId?: string; groupId?: string }, file: File) => {
    const res = await client.api.uploads.$post({
      json: { ...thread, contentType: file.type, size: file.size },
    });
    const ticket = await unwrap<{ uploadUrl: string; imageKey: string; contentType: string }>(res);
    await putToStorage(ticket.uploadUrl, file);
    return ticket.imageKey;
  },
};
