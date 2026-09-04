'use client';

import { HotTopicHeader } from './HotTopicHeader';
import styles from './HotTopicDashboard.module.scss';

interface HotTopicStickyShellProps {
  filterBar?: React.ReactNode;
  children: React.ReactNode;
}

export function HotTopicStickyShell({ filterBar, children }: HotTopicStickyShellProps) {
  return (
    <div className={styles.dashboard}>
      <div className={styles.stickyTopBar}>
        <HotTopicHeader />
        {filterBar}
      </div>
      {children}
    </div>
  );
}
