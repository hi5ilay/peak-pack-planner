import { useState } from 'react';
import styles from './ItemIcon.module.css';

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  id: string;
  name: string;
  size?: number;
}

/** Loads public/icons/<id>.png. Shows a rounded square with initials when the file is missing. */
export function ItemIcon({ id, name, size = 40 }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.34) };
  if (failed) {
    return (
      <span className={styles.placeholder} style={style} aria-hidden="true">
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      className={styles.icon}
      style={style}
      src={`${import.meta.env.BASE_URL}icons/${id}.png`}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
