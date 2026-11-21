import styles from './Footer.module.css';

export const LEGAL_TEXT =
  'This is an unofficial project and is not affiliated with, endorsed, or sponsored by Aggro Crab or Landfall Games. All game assets, icons, screenshots, and trademarks are property of Aggro Crab, Landfall Games and/or their licensors.';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p>{LEGAL_TEXT}</p>
      <p>
        Game data from the <a href="https://peak.wiki.gg" target="_blank" rel="noreferrer">PEAK community wiki (peak.wiki.gg)</a>,
        plus a few corrections from real gameplay. Code is open source under the MIT license (code only, not game assets).
      </p>
    </footer>
  );
}
