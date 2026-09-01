'use client';

import { HotTopicHeader } from './HotTopicHeader';
import styles from './HotTopicDashboard.module.scss';

interface HotTopicStickyShellProps {
  onScrapeSuccess?: () => void | Promise<void>;
  filterBar?: React.ReactNode;
  children: React.ReactNode;
}

export function HotTopicStickyShell({
  onScrapeSuccess,
  filterBar,
  children,
}: HotTopicStickyShellProps) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.stickyTopBar}>
        <HotTopicHeader onScrapeSuccess={onScrapeSuccess} />
        {filterBar}
      </div>
      {children}
    </div>
  );
}
