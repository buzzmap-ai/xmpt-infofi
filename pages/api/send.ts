import type { NextApiRequest, NextApiResponse } from 'next';
import { xmtpService } from '../../src/xmtpService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { conversationId, content } = req.body;
      
      if (!conversationId || !content) {
        return res.status(400).json({ error: 'Missing conversationId or content' });
      }

      await xmtpService.sendMessage(conversationId, content);
      res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 