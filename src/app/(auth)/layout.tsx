import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-sm font-semibold text-indigo-600">
          Campus Incident Management System
        </Link>
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
