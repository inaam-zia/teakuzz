import { getBranding } from "@/lib/branding";
import AdminLoginForm from "./login-form";

export default async function AdminLoginPage() {
  const branding = await getBranding();
  const year = new Date().getFullYear();

  return (
    <main className="order-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-3xl border border-brand bg-brand-surface shadow-md">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-brand-heading">
                {branding.appName.charAt(0)}
              </span>
            )}
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-heading">
            {branding.appName}
          </h1>
          <p className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-brand-subtle">
            Admin Portal
          </p>
        </div>

        <div className="card space-y-5 shadow-lg">
          <div className="text-center">
            <h2 className="text-lg font-bold text-cafe-900">Welcome back</h2>
            <p className="mt-1 text-sm text-cafe-600">
              Sign in to manage menu and orders
            </p>
          </div>

          <AdminLoginForm />
        </div>

        <p className="mt-8 text-center text-xs text-brand-subtle">
          © {year} {branding.appName}
        </p>
      </div>
    </main>
  );
}
