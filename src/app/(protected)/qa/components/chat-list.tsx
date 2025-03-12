import { MessageSquare } from "lucide-react";

interface ChatListProps {
  chats: any[]; // Replace with proper type
  onChatClick: (index: number) => void;
}

export default function ChatList({ chats, onChatClick }: ChatListProps) {
  if (!chats?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {chats.map((chat, idx) => {
        // First question as title and count of total messages
        const messageCount = chat.questions.length;

        return (
          <div
            key={chat.id}
            onClick={() => onChatClick(idx)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-primary/20 p-4 shadow bg-card hover:bg-secondary dark:bg-background dark:hover:bg-primary/10 hover:transition"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <p className="line-clamp-1 break-words text-lg font-medium text-gray-700 dark:text-gray-200">
                  {chat.title}
                </p>
                <span className="shrink-0 text-xs text-gray-400 sm:ml-2">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 break-words text-sm text-gray-500 dark:text-gray-400">
                {messageCount} message{messageCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
