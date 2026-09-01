'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, BellRing, Globe, Loader2, ScanLine, Users } from 'lucide-react';
import { alertsApi } from '@/lib/api/alerts';
import { getApiErrorMessage } from '@/lib/api/client';
import { channelsApi } from '@/lib/api/channels';
import { scraperApi } from '@/lib/api/scraper';
import { cn } from '@/lib/utils';
import { MakeToast } from '@/lib/utils/toast';
import styles from './HotTopicDashboard.module.scss';

/** Tạm ẩn: Quét YouTube, Check alert, Đăng nhập, Ngôn ngữ — đổi `true` khi cần mở lại */
const SHOW_HEADER_UTILITY_ACTIONS = false;

interface HotTopicHeaderProps {
  /** Gọi sau khi quét YouTube thành công — dùng để reload dữ liệu trang hiện tại */
  onScrapeSuccess?: () => void | Promise<void>;
}

export function HotTopicHeader({ onScrapeSuccess }: HotTopicHeaderProps) {
  const pathname = usePathname();
  const [scraping, setScraping] = useState(false);
  const [checkingAlert, setCheckingAlert] = useState(false);

  const isHome = pathname === '/home' || pathname === '/';
  const isSubjectsArea =
    pathname === '/subjects' || pathname.startsWith('/subjects/') || pathname === '/channels';

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const [ytRes, ttRes, fbRes] = await Promise.all([
        channelsApi.list({ type_channel: 'youtube', per_page: 100 }),
        channelsApi.list({ type_channel: 'tiktok', per_page: 100 }),
        channelsApi.list({ type_channel: 'facebook', per_page: 100 }),
      ]);
      const ytIds = (ytRes.data?.result || []).map((ch) => ch.id);
      const ttIds = (ttRes.data?.result || []).map((ch) => ch.id);
      const fbIds = (fbRes.data?.result || []).map((ch) => ch.id);

      if (ytIds.length === 0 && ttIds.length === 0 && fbIds.length === 0) {
        MakeToast({
          variant: 'warning',
          content: 'Chưa có kênh YouTube/TikTok/Facebook nào trong danh mục',
        });
        return;
      }

      const ok = window.confirm(
        `Quét dữ liệu ${ytIds.length} kênh YouTube, ${ttIds.length} kênh TikTok và ${fbIds.length} kênh Facebook?`
      );
      if (!ok) return;

      let itemsCount = 0;
      let channelsScraped = 0;
      let comments = 0;
      let skipped = 0;

      if (ytIds.length > 0) {
        const scrapeRes = await scraperApi.runYoutube({ channel_id: ytIds });
        const data = scrapeRes.data;
        itemsCount += data?.items_count ?? 0;
        channelsScraped += data?.channels_scraped ?? 0;
        comments += data?.comment_stats?.videos_with_comments ?? 0;
        skipped += data?.channels_skipped?.length ?? 0;
      }
      if (ttIds.length > 0) {
        const scrapeRes = await scraperApi.runTikTok({ channel_id: ttIds });
        const data = scrapeRes.data;
        itemsCount += data?.items_count ?? 0;
        channelsScraped += data?.channels_scraped ?? 0;
        comments += data?.comment_stats?.videos_with_comments ?? 0;
        skipped += data?.channels_skipped?.length ?? 0;
      }
      if (fbIds.length > 0) {
        const scrapeRes = await scraperApi.runFacebook({ channel_id: fbIds });
        const data = scrapeRes.data;
        itemsCount += data?.items_count ?? 0;
        channelsScraped += data?.channels_scraped ?? 0;
        comments +=
          data?.comment_stats?.posts_with_comments ??
          data?.comment_stats?.videos_with_comments ??
          0;
        skipped += data?.channels_skipped?.length ?? 0;
      }

      MakeToast({
        variant: 'success',
        content: `Đã quét ${itemsCount} bài · ${channelsScraped} kênh${comments ? ` · ${comments} bài có comment` : ''}${skipped ? ` · bỏ qua ${skipped} kênh chưa gắn subject` : ''}`,
      });
      await onScrapeSuccess?.();
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setScraping(false);
    }
  };

  const handleCheckAlert = async () => {
    setCheckingAlert(true);
    try {
      const res = await alertsApi.checkGmail();
      const data = res.data;

      if (data?.sent) {
        const bccNote =
          data.bcc_count && data.bcc_count > 0 ? ` · BCC ${data.bcc_count} người` : '';

        if (data.reason === 'no_candidates_over_threshold') {
          const hot = data.thresholds?.hot ?? '?';
          const trend = data.thresholds?.trend ?? '?';
          MakeToast({
            variant: 'success',
            content: `Đã gửi email: không có đối tượng vượt ngưỡng (hot ≥ ${hot}, trend ≥ ${trend})${bccNote}`,
          });
          return;
        }

        MakeToast({
          variant: 'success',
          content: `Đã gửi cảnh báo ${data.count} đối tượng vượt ngưỡng hot/trend${bccNote}`,
        });
        return;
      }

      MakeToast({ variant: 'info', content: 'Đã kiểm tra cảnh báo — không có bản ghi cần gửi' });
    } catch (err) {
      MakeToast({ variant: 'danger', content: getApiErrorMessage(err) });
    } finally {
      setCheckingAlert(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/home" className={styles.logo}>
          <span className={styles.logoSocial}>NetScope</span>
          <span className={styles.logoTrend}>Trend</span>
          <span className={styles.logoBy}>base on Younet Media</span>
        </Link>

        <nav className={styles.mainNav} aria-label="Main navigation">
          <div className={styles.navLinks}>
            <Link href="/home" className={cn(styles.navLink, isHome && styles.navLinkActive)}>
              <BarChart3 size={16} aria-hidden />
              Xếp hạng
            </Link>
            <Link
              href="/subjects"
              className={cn(styles.navLink, isSubjectsArea && styles.navLinkActive)}
            >
              <Users size={16} aria-hidden />
              Đối tượng
            </Link>
          </div>

          {SHOW_HEADER_UTILITY_ACTIONS && (
            <div className={styles.navActions}>
              <button
                type="button"
                className={cn(styles.navActionBtn, styles.navActionScrape)}
                onClick={() => void handleScrapeAll()}
                disabled={scraping || checkingAlert}
                title="Quét video mới nhất từ tất cả kênh YouTube/TikTok"
              >
                {scraping ? (
                  <Loader2 size={16} className={styles.spin} aria-hidden />
                ) : (
                  <ScanLine size={16} aria-hidden />
                )}
                {scraping ? 'Đang quét…' : 'Quét YT/TT'}
              </button>
              <button
                type="button"
                className={cn(styles.navActionBtn, styles.navActionAlert)}
                onClick={() => void handleCheckAlert()}
                disabled={checkingAlert || scraping}
                title="Kiểm tra và gửi cảnh báo Gmail khi vượt ngưỡng hot/trend"
              >
                {checkingAlert ? (
                  <Loader2 size={16} className={styles.spin} aria-hidden />
                ) : (
                  <BellRing size={16} aria-hidden />
                )}
                {checkingAlert ? 'Đang kiểm tra…' : 'Check alert'}
              </button>
            </div>
          )}
        </nav>

        {SHOW_HEADER_UTILITY_ACTIONS && (
          <div className={styles.headerActions}>
            <button type="button" className={styles.loginBtn}>
              Đăng nhập
            </button>
            <button type="button" className={styles.langBtn} aria-label="Ngôn ngữ">
              <Globe size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
