import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.ts";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-amber-700 text-white hover:bg-amber-800",
        secondary: "bg-stone-200 text-stone-900 hover:bg-stone-300",
        danger: "bg-red-700 text-white hover:bg-red-800",
        ghost: "text-amber-800 hover:bg-amber-50",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", full: false },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ variant, full, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, full }), className)} {...props} />;
}
