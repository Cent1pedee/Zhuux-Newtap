"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/**
 * Magic UI · Tilted Card
 * 指针位置映射到 rotateX / rotateY（spring 平滑），离开归零。
 * reduce 时完全静态。
 */
export function TiltedCard({
  children,
  className = "",
  reduce = false,
  max = 8,
  scale = 1.02,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  reduce?: boolean;
  max?: number;
  scale?: number;
  style?: React.CSSProperties;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 320, damping: 26, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 320, damping: 26, mass: 0.6 });
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={{ ...style, rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale }}
      transition={{ duration: 0.18 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const rect = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
    </motion.div>
  );
}
