import './globals.css';

export const metadata = {
  title: '无名岛 · Unnamed Island',
  description: '一座小岛，一段属于你的冒险。',
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
