"use client";
import * as React from "react";
import { cn } from "../../lib/utils";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const radius = 100; // change this to increase the radius of the hover effect
    const [visible, setVisible] = React.useState(false);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
      const { left, top } = currentTarget.getBoundingClientRect();
      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-neutral-200"
          >
            {label}
          </label>
        )}
        <motion.div
          style={{
            background: useMotionTemplate`
              radial-gradient(
                ${visible ? radius + "px" : "0px"} circle at ${mouseX}px ${mouseY}px,
                rgba(59, 130, 246, 0.15),
                transparent 80%
              )
            `,
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
          className="group/input rounded-lg p-[2px] transition duration-300"
        >
          <input
            type={type}
            id={id}
            className={cn(
              `flex h-10 w-full rounded-md border-none bg-background px-3 py-2 text-sm text-white shadow-input
               placeholder:text-neutral-500
               focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-primary
               disabled:cursor-not-allowed disabled:opacity-50
               transition duration-200
               file:border-0 file:bg-transparent file:text-sm file:font-medium`,
              error && "ring-2 ring-destructive",
              className
            )}
            ref={ref}
            {...props}
          />
        </motion.div>
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
