import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginForm } from './LoginForm';
import { Icon } from '@/components/Icon';

export const metadata = { title: 'Sign in' };

const ASSURANCES = [
  { icon: 'lock', title: 'Encrypted' },
  { icon: 'shield', title: 'Role-based' },
  { icon: 'eye', title: 'Audited' },
] as const;

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/');

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-white px-6 py-12">
      {/* Dotted field — fades out toward the edges so the centre stays calm. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(11,13,10,0.13) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 90% 90% at 50% 45%, black 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 45%, black 55%, transparent 100%)',
        }}
      />
      {/* A quiet green glow behind the card — the only colour on the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.14] blur-3xl"
        style={{ background: 'radial-gradient(circle, #4EA310 0%, transparent 62%)' }}
      />

      {/* ------------------------------------------ one centred column */}
      <div className="relative w-full max-w-[420px]">
        <div className="rounded-2xl border border-paper-200 bg-white p-7 shadow-card sm:p-9">
          <div className="mb-8 flex justify-center">
            <Image src="/10x-logo-black.png" alt="10X" width={96} height={46} className="h-10 w-auto" priority />
          </div>
          <LoginForm />
        </div>

        {/* Three quiet reassurances — what protects this door, in the same
            order someone would ask: who gets in, what they can touch, and
            what is written down afterwards. */}
        <ul className="mt-6 grid grid-cols-3 items-stretch gap-2.5">
          {ASSURANCES.map((item) => (
            <li
              key={item.title}
              className="flex h-full flex-col items-center rounded-xl border border-paper-200 bg-white/70 px-2.5 py-3 text-center backdrop-blur-sm"
            >
              <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-pressed">
                <Icon name={item.icon} className="h-3.5 w-3.5" />
              </span>
              <p className="text-[11.5px] font-semibold leading-tight text-fg">{item.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
