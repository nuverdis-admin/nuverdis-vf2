"use client";

import { useRef, useState, useTransition } from "react";
import { sendOtpAction, verifyOtpAction } from "./actions";

export function LoginForm() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSendOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await sendOtpAction(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        setEmail(result.email);
        setStep("otp");
      }
    });
  };

  const otpFormRef = useRef<HTMLFormElement>(null);

  const handleVerifyOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await verifyOtpAction(formData);
      if (result && "error" in result) {
        setError(result.error);
      }
    });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    e.target.value = value;
    if (value.length === 8) {
      otpFormRef.current?.requestSubmit();
    }
  };

  if (step === "otp") {
    return (
      <form ref={otpFormRef} onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
        {error && (
          <div
            role="alert"
            className="rounded-md bg-critique-1 px-4 py-3 text-sm text-critique-7"
          >
            {error}
          </div>
        )}

        <div className="rounded-md bg-gray-1 px-4 py-3 text-sm text-gray-6">
          Código enviado a{" "}
          <span className="font-semibold text-gray-9">{email}</span>
        </div>

        <input type="hidden" name="email" value={email} />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="token"
            className="text-sm font-semibold text-gray-8"
          >
            Código de verificación
          </label>
          <input
            id="token"
            name="token"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={8}
            required
            autoComplete="one-time-code"
            placeholder="••••••••"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onChange={handleOtpChange}
            className="rounded-md border border-gray-3 bg-gray-0 px-3 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-gray-9 placeholder:text-gray-5 focus:border-primary-5 focus:outline-none focus:ring-2 focus:ring-primary-2 transition-colors"
          />
          <p className="text-xs text-gray-5">
            Revisa tu bandeja de entrada y la carpeta de spam.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary w-full rounded-lg"
        >
          {isPending ? "Verificando…" : "Verificar código"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setStep("email");
            setError(null);
          }}
          className="text-sm text-gray-6 hover:text-gray-9 transition-colors disabled:opacity-50"
        >
          ← Cambiar correo
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
      {error && (
        <div
          role="alert"
          className="rounded-md bg-critique-1 px-4 py-3 text-sm text-critique-7"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-gray-8">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="usuario@empresa.com"
          className="rounded-md border border-gray-3 bg-gray-0 px-3 py-2.5 text-sm text-gray-9 placeholder:text-gray-5 focus:border-primary-5 focus:outline-none focus:ring-2 focus:ring-primary-2 transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="btn btn-primary w-full rounded-lg"
      >
        {isPending ? "Enviando código…" : "Enviar código"}
      </button>
    </form>
  );
}
