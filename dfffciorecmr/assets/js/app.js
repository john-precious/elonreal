// assets/js/app.js - Twitter / X Elon Musk Profile Frontend Logic

let currentTab = 'posts';
let currentPage = 1;
let hasMoreTweets = true;
let isLoadingTweets = false;
let currentUser = null;
let isElonFollowing = false;
let isBellActive = false;
let infiniteScrollObserver = null;

// ============================================================================
// AUTOMATIC VISITOR IDENTIFICATION & PERSISTENCE
// ============================================================================
function getOrCreateVisitorId() {
  let vid = localStorage.getItem('xtag_visitor_id');
  if (!vid) {
    const match = document.cookie.match(new RegExp('(^|;\\s*)xtag_visitor_id=([^;]+)'));
    if (match && match[2]) {
      vid = match[2];
    }
  }
  if (!vid || !/^[a-zA-Z0-9_\-]+$/.test(vid)) {
    vid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  }
  try {
    localStorage.setItem('xtag_visitor_id', vid);
  } catch (e) {}
  const d = new Date();
  d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
  document.cookie = `xtag_visitor_id=${encodeURIComponent(vid)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  return vid;
}

function getDeviceInfo() {
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet (' + (navigator.platform || 'iPad') + ')';
  if (/iPhone/i.test(ua)) return 'Mobile (iPhone)';
  if (/Android/i.test(ua)) return 'Mobile (Android)';
  if (/Windows/i.test(ua)) return 'Desktop (Windows)';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Desktop (macOS)';
  if (/Linux/i.test(ua)) return 'Desktop (Linux)';
  return 'Desktop';
}

function getBrowserInfo() {
  const ua = navigator.userAgent || '';
  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';
  return browser;
}

async function trackVisitorSession() {
  try {
    const vid = getOrCreateVisitorId();
    const res = await fetch('api/user.php?action=track_visitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Visitor-Id': vid
      },
      body: JSON.stringify({
        visitor_id: vid,
        device_info: getDeviceInfo(),
        browser_info: getBrowserInfo()
      })
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      const indicator = document.getElementById('msgVisitorIndicatorText');
      if (indicator) {
        indicator.textContent = data.user.name || 'Encrypted Chat';
      }
    }
  } catch (e) {
    console.warn('Visitor tracking error:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  setupEventListeners();
  initInfiniteScroll();
  loadTweets('posts', false);
});

// Render static icons across the page
function initIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    if (Icons[iconName]) {
      el.innerHTML = Icons[iconName];
    }
  });
}

// Load initial user state, profile data, and tweets
async function loadInitialData() {
  try {
    const res = await fetch('api/user.php', {
      headers: { 'X-Visitor-Id': getOrCreateVisitorId() }
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.current_user;
      isElonFollowing = data.is_following_elon;
      updateUserProfileUI(data);
      renderWhoToFollow(data.who_to_follow);
      renderTrends(data.trends);
    }
    loadTweets(currentTab, false);
  } catch (err) {
    console.error('Error loading initial data:', err);
    loadTweets('posts', false);
  }
}

// Update Header, Follow buttons, and User switcher UI
function updateUserProfileUI(data) {
  const elon = data.elon_profile;
  if (elon) {
    const headerProfileName = document.getElementById('headerProfileName');
    if (headerProfileName) {
      headerProfileName.innerHTML = `${elon.name} ${Icons.verifiedBlue} ${Icons.affiliateX}`;
    }
    const profileFullName = document.getElementById('profileFullName');
    if (profileFullName) profileFullName.innerHTML = `${elon.name} ${Icons.verifiedBlue} ${Icons.affiliateX}`;
    const profileHandle = document.getElementById('profileHandle');
    if (profileHandle) profileHandle.textContent = elon.handle;
    const profileBio = document.getElementById('profileBio');
    if (profileBio) profileBio.innerHTML = formatTweetText(elon.bio);
    const profileLocation = document.getElementById('profileLocation');
    if (profileLocation) profileLocation.textContent = elon.location;
    const profileJoined = document.getElementById('profileJoined');
    if (profileJoined) profileJoined.textContent = `Joined ${elon.joined_date}`;
    const followersCount = document.getElementById('followersCount');
    if (followersCount) followersCount.textContent = formatNumber(elon.followers_count);
    const followingCount = document.getElementById('followingCount');
    if (followingCount) followingCount.textContent = formatNumber(elon.following_count);
  }

  // Update Follow button state
  const btnFollow = document.getElementById('btnElonFollow');
  if (btnFollow) {
    if (isElonFollowing) {
      btnFollow.classList.add('following');
      btnFollow.textContent = 'Following';
    } else {
      btnFollow.classList.remove('following');
      btnFollow.textContent = 'Follow';
    }
  }

  // Update user capsule if present
  if (currentUser) {
    const av = document.getElementById('userCapsuleAvatar');
    const nm = document.getElementById('userCapsuleName');
    const hd = document.getElementById('userCapsuleHandle');
    const comp = document.getElementById('inlineComposerAvatar');
    if (av) av.src = currentUser.avatar_url;
    if (nm) nm.textContent = currentUser.name;
    if (hd) hd.textContent = currentUser.handle;
    if (comp) comp.src = currentUser.avatar_url;
  }
}

// Render "Who to follow" in right sidebar
function renderWhoToFollow(users) {
  const container = document.getElementById('whoToFollowList');
  if (!container || !users) return;

  container.innerHTML = users.map(u => `
    <div class="follow-item" onclick="viewUserProfile('${u.handle}')">
      <div class="follow-item-left">
        <img src="${u.avatar_url}" alt="${u.name}" class="follow-avatar" onerror="this.onerror=null;this.src='assets/images/guest_avatar.jpg';" />
        <div class="follow-info">
          <div class="follow-name">
            ${u.name}
            ${u.verified_type === 'gold' ? Icons.verifiedGold : (u.is_verified ? Icons.verifiedBlue : '')}
          </div>
          <div class="follow-handle">${u.handle}</div>
        </div>
      </div>
      <button class="btn-follow-sm ${u.is_following ? 'following' : ''}" 
              onclick="event.stopPropagation(); toggleFollowUser(${u.id}, this)" type="button">
        ${u.is_following ? 'Following' : 'Follow'}
      </button>
    </div>
  `).join('');
}

// Render "What's happening" trending widget
function renderTrends(trends) {
  const container = document.getElementById('trendsList');
  if (!container || !trends) return;

  container.innerHTML = trends.map(t => `
    <div class="trend-item" onclick="searchTrend('${t.hashtag}')">
      <div class="trend-info">
        <span class="trend-category">${t.category}</span>
        <span class="trend-title">${t.hashtag}</span>
        <span class="trend-posts-count">${t.post_count}</span>
      </div>
      <div class="btn-tweet-menu static-dots" onclick="event.stopPropagation(); event.preventDefault(); return false;" aria-hidden="true">${Icons.dots}</div>
    </div>
  `).join('');
}

// ============================================================================
// FRONTEND-ONLY PORTFOLIO DEMO FEED
// All posts and engagement figures below are simulated demo data.
// 1,200 posts / 6 per page = 200 scrollable pages.
// ============================================================================
const POSTS_PER_PAGE = 6;
const DEMO_POST_TOTAL = 1200;

const demoPostTexts = [
  "Building the future takes patience, curiosity, and a willingness to solve hard problems.",
  "The most interesting breakthroughs often begin with a simple question: why not?",
  "Progress is a team effort. Great ideas become real through consistent execution.",
  "A better future is built one experiment, one lesson, and one improvement at a time.",
  "Think from first principles. Challenge assumptions. Keep learning.",
  "The goal is not to move fast blindly. The goal is to make meaningful progress.",
  "🚀 THE 40% GIVEAWAY IS LIVE! Enter now and unlock incredible savings",
  "Technology should make useful things more accessible to more people.",
  "Curiosity is a powerful advantage. Never stop asking better questions.",
  "Big projects are just many small, well-executed steps connected together.",
  "Keep the feedback loop short: build, test, learn, and improve.",
  "A good team turns ambitious ideas into practical results.",
  "The future belongs to people who are willing to learn and adapt."
];

const demoPostImages = [
  "assets/images/posts/post-1.jpeg",
  "assets/images/posts/post-2.jpeg",
  "assets/images/posts/post-3.jpeg",
  "assets/images/posts/post-4.jpeg",
  "assets/images/posts/post-5.jpeg",
  "assets/images/posts/post-6.jpeg",
  "assets/images/posts/post-7.jpeg",
  "assets/images/posts/post-8.jpeg",
  "assets/images/posts/post-9.jpeg",
  "assets/images/posts/post-10.jpeg",
];


const demoTweets = Array.from({ length: DEMO_POST_TOTAL }, (_, index) => {
  const number = index + 1;
  const metric = (seed) => 50000 + ((number * seed) % 10001);
  const minutesAgo = number * 17;
  let timeAgo;
  if (minutesAgo < 60) timeAgo = `${minutesAgo}m`;
  else if (minutesAgo < 1440) timeAgo = `${Math.floor(minutesAgo / 60)}h`;
  else timeAgo = `${Math.floor(minutesAgo / 1440)}d`;

  return {
    id: DEMO_POST_TOTAL - index,
    real_id: DEMO_POST_TOTAL - index,
    name: 'ELON MUSK',
    handle: '@elonmusk',
    avatar_url: 'assets/images/spacex_avatar.jpg',
    content: demoPostTexts[index % demoPostTexts.length],
    time_ago: timeAgo,
    formatted_date: 'Simulated portfolio post',
    verified_type: '',
    is_verified: false,
    is_affiliate: false,
    is_pinned: index === 0,
    replies_count: metric(7),
    retweets_count: metric(13),
    likes_count: metric(29),
    views_count: metric(113),
    is_liked: false,
    is_bookmarked: false,
    media_url: demoPostImages[index % demoPostImages.length],   
    poll: null,
    quote_tweet: null,
    reply_to_tweet: null
  };
});

// Render one local page of demo posts. No PHP/API backend is required.
function loadTweets(tab, append = false) {
  if (isLoadingTweets) return;
  isLoadingTweets = true;

  const stream = document.getElementById('tweetsStream');
  const scrollLoader = document.getElementById('infiniteScrollLoader');
  if (!stream) {
    isLoadingTweets = false;
    return;
  }

  currentTab = tab || 'posts';
  if (!append) {
    currentPage = 1;
    hasMoreTweets = true;
    stream.innerHTML = `
      <div style="display:flex; justify-content:center; padding:32px; color:var(--twitter-blue);">
        Loading posts...
      </div>
    `;
  } else if (scrollLoader) {
    scrollLoader.style.display = 'flex';
  }

  // Keep a short delay so the demo has a natural loading transition.
  window.setTimeout(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    const pagePosts = demoTweets.slice(startIndex, endIndex);

    if (!pagePosts.length) {
      hasMoreTweets = false;
      isLoadingTweets = false;
      if (scrollLoader) scrollLoader.style.display = 'none';
      return;
    }

    const html = pagePosts.map(post => renderTweetCard(post)).join('');
    if (append) stream.insertAdjacentHTML('beforeend', html);
    else stream.innerHTML = html;

    hasMoreTweets = endIndex < demoTweets.length;
    isLoadingTweets = false;
    if (scrollLoader) scrollLoader.style.display = 'none';

    // If the page is not tall enough to scroll yet, automatically load another page.
    if (hasMoreTweets) window.setTimeout(checkViewportFill, 150);
  }, 120);
}

// Load next page of tweets automatically on scroll
function loadMoreTweets() {
  if (!hasMoreTweets || isLoadingTweets) return;
  currentPage++;
  loadTweets(currentTab, true);
}

// If content does not reach the bottom of the viewport, keep loading until scrollable
function checkViewportFill() {
  if (!hasMoreTweets || isLoadingTweets) return;
  const sentinel = document.getElementById('infiniteScrollSentinel');
  if (!sentinel) return;
  const rect = sentinel.getBoundingClientRect();
  if (rect.top <= window.innerHeight + 150) {
    loadMoreTweets();
  }
}

// Initialize high-performance Infinite Scroll Observer + scroll event listener
function initInfiniteScroll() {
  const sentinel = document.getElementById('infiniteScrollSentinel');
  if (!sentinel) return;

  if ('IntersectionObserver' in window) {
    if (infiniteScrollObserver) {
      infiniteScrollObserver.disconnect();
    }
    infiniteScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && hasMoreTweets && !isLoadingTweets) {
          loadMoreTweets();
        }
      });
    }, {
      root: null,
      rootMargin: '450px 0px', // Pre-fetch 450px ahead of bottom for silky smooth scrolling
      threshold: 0.01
    });

    infiniteScrollObserver.observe(sentinel);
  }

  // Window scroll fallback handler with throttling
  let isThrottled = false;
  window.addEventListener('scroll', () => {
    if (isThrottled || !hasMoreTweets || isLoadingTweets) return;
    isThrottled = true;
    setTimeout(() => {
      isThrottled = false;
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollY + windowHeight >= docHeight - 550) {
        loadMoreTweets();
      }
    }, 100);
  }, { passive: true });
}

// ============================================================================
// REAL-TIME TIMELINE & PROFILE SYNCHRONIZATION SYSTEM
// Instantly reflects all admin changes (content, timestamp, metrics, additions, deletions, profile)
// ============================================================================
let timelineSyncChannel = null;
let timelineSyncPollTimer = null;
let lastKnownSyncHash = null;
let isSilentSyncing = false;

function initTimelineRealTimeSync() {
  // 1. Instant cross-tab sync via BroadcastChannel (0ms latency in same browser)
  if ('BroadcastChannel' in window) {
    try {
      timelineSyncChannel = new BroadcastChannel('xtag_timeline_sync');
      timelineSyncChannel.onmessage = (event) => {
        handleRealTimeSyncEvent(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 2. Storage event listener (cross-tab fallback)
  window.addEventListener('storage', (e) => {
    if (e.key === 'xtag_last_sync_time' || e.key === 'xtag_last_sync_payload') {
      try {
        const payload = (e.key === 'xtag_last_sync_payload' && e.newValue) 
          ? JSON.parse(e.newValue) 
          : { type: 'storage_sync' };
        handleRealTimeSyncEvent(payload);
      } catch (err) {
        handleRealTimeSyncEvent({ type: 'storage_sync' });
      }
    }
  });

  // 3. Tab visibility & focus triggers
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkTimelineSyncStatus();
    }
  });
  window.addEventListener('focus', () => {
    checkTimelineSyncStatus();
  });

  // 4. Initial sync check + fast periodic poll (every 1.5s) for near-instant cross-device/browser sync
  checkTimelineSyncStatus();
  if (!timelineSyncPollTimer) {
    timelineSyncPollTimer = setInterval(() => {
      checkTimelineSyncStatus();
    }, 1500);
  }
}

function handleRealTimeSyncEvent(payload) {
  if (!payload || !payload.type) return;

  // Always refresh buttons config - any admin change could affect UI buttons
  fetchUiButtonsConfig();

  if (payload.type === 'profile_updated' || payload.type === 'profile_media_updated') {
    loadInitialData();
  }

  // Immediately synchronize timeline for any post change, metric update, deletion, or new post
  silentSyncTimeline();
}

async function checkTimelineSyncStatus() {
  try {
    const res = await fetch(`api/get_tweets.php?sync_check=1&_nocache=${Date.now()}`, {
      headers: { 'X-Visitor-Id': getOrCreateVisitorId() }
    });
    const data = await res.json();
    if (!data.success) return;

    if (lastKnownSyncHash === null) {
      lastKnownSyncHash = data.sync_hash;
      return;
    }

    if (data.sync_hash !== lastKnownSyncHash) {
      lastKnownSyncHash = data.sync_hash;
      // Sync everything: timeline, profile, and buttons
      silentSyncTimeline();
      fetchUiButtonsConfig();

      if (data.user) {
        updateUserProfileHeaderInPlace(data.user);
      }
    }
  } catch (err) {
    // Retry on next cycle
  }
}

async function silentSyncTimeline() {
  if (isSilentSyncing) return;
  isSilentSyncing = true;

  try {
    const stream = document.getElementById('tweetsStream');
    if (!stream) {
      // If viewing tweet.php thread permalink
      const threadStream = document.getElementById('permalinkThreadStream');
      if (threadStream) {
        const urlParams = new URLSearchParams(window.location.search);
        const tId = urlParams.get('id') || '1';
        const res = await fetch(`api/get_tweets.php?tweet_id=${tId}&_nocache=${Date.now()}`, {
          headers: { 'X-Visitor-Id': getOrCreateVisitorId() }
        });
        const data = await res.json();
        if (data.success && data.tweet) {
          updateSingleTweetInDOM(data.tweet);
        }
      }
      return;
    }

    const res = await fetch(`api/get_tweets.php?tab=${encodeURIComponent(currentTab)}&page=1&limit=6&_nocache=${Date.now()}`, {
      headers: { 'X-Visitor-Id': getOrCreateVisitorId() }
    });
    const data = await res.json();
    if (!data.success || !data.tweets) return;

    const freshTweets = data.tweets;
    const existingCards = stream.querySelectorAll('.tweet-card');

    const existingIds = Array.from(existingCards).slice(0, freshTweets.length).map(card => {
      return parseInt(card.id.replace('tweet-', '')) || 0;
    });
    const freshIds = freshTweets.map(t => t.id);

    const idsMatch = (existingIds.length === freshIds.length) && existingIds.every((id, idx) => id === freshIds[idx]);

    // Check if pinned state changed on any fresh tweet
    let pinnedChanged = false;
    freshTweets.forEach(t => {
      const card = document.getElementById(`tweet-${t.id}`);
      if (card) {
        const hasPinnedBadge = !!card.querySelector('.tweet-pinned-badge');
        if (hasPinnedBadge !== !!t.is_pinned) {
          pinnedChanged = true;
        }
      }
    });

    if (!idsMatch || pinnedChanged || existingCards.length === 0) {
      // Structure/ordering/new post/deletion occurred: update page 1 smoothly
      if (currentPage === 1) {
        stream.innerHTML = freshTweets.map(t => renderTweetCard(t)).join('');
      } else {
        const newHtml = freshTweets.map(t => renderTweetCard(t)).join('');
        for (let i = 0; i < existingIds.length; i++) {
          const oldEl = document.getElementById(`tweet-${existingIds[i]}`);
          if (oldEl) oldEl.remove();
        }
        stream.insertAdjacentHTML('afterbegin', newHtml);
      }
    } else {
      // IDs and ordering match: perform smooth in-place DOM updates (flicker-free!)
      freshTweets.forEach(t => {
        updateSingleTweetInDOM(t);
      });
    }

  } catch (err) {
    console.error('Silent timeline sync error:', err);
  } finally {
    isSilentSyncing = false;
  }
}

function updateSingleTweetInDOM(t) {
  const card = document.getElementById(`tweet-${t.id}`);
  if (!card) return;

  // 1. Timestamp button label (e.g. Â· Jan or Â· 2h)
  const timeEl = card.querySelector('.tweet-timestamp');
  if (timeEl && t.time_ago) {
    if (timeEl.textContent !== t.time_ago) {
      timeEl.textContent = t.time_ago;
      timeEl.title = `Published ${t.formatted_date || t.time_ago}`;
    }
  }

  // 2. Tweet content text
  const textEl = card.querySelector('.tweet-text');
  if (textEl && t.content) {
    const formatted = formatTweetText(t.content);
    if (textEl.innerHTML !== formatted) {
      textEl.innerHTML = formatted;
    }
  }

  // 3. Comments metric
  const repBtn = card.querySelector('.action-btn.reply');
  if (repBtn) {
    const repCountEl = repBtn.querySelector('.action-count');
    if (repCountEl) repCountEl.textContent = formatNumber(t.replies_count);
    repBtn.title = `Comments: ${Number(t.replies_count || 0).toLocaleString()}`;
  }

  // 4. Reposts metric
  const retBtn = card.querySelector('.action-btn.retweet');
  if (retBtn) {
    const retCountEl = retBtn.querySelector('.action-count');
    if (retCountEl) retCountEl.textContent = formatNumber(t.retweets_count);
    retBtn.title = `Reposts: ${Number(t.retweets_count || 0).toLocaleString()}`;
  }

  // 5. Likes metric
  const likeBtn = card.querySelector('.action-btn.like');
  if (likeBtn) {
    const likeCountEl = likeBtn.querySelector('.action-count');
    const likeIconEl = likeBtn.querySelector('.action-icon-circle');
    if (likeCountEl) likeCountEl.textContent = formatNumber(t.likes_count);
    likeBtn.setAttribute('data-likes', t.likes_count || 0);
    likeBtn.classList.toggle('active', !!t.is_liked);
    if (likeIconEl) likeIconEl.innerHTML = t.is_liked ? Icons.likeFilled : Icons.like;
    likeBtn.title = `${t.is_liked ? 'Unlike' : 'Like'} (${Number(t.likes_count || 0).toLocaleString()})`;
  }

  // 6. Views metric
  const viewsBtn = card.querySelector('.action-btn.views');
  if (viewsBtn) {
    const viewsCountEl = viewsBtn.querySelector('.action-count');
    if (viewsCountEl) viewsCountEl.textContent = formatNumber(t.views_count);
    viewsBtn.title = `Views: ${Number(t.views_count || 0).toLocaleString()}`;
  }

  // 7. Media embed
  const mediaImg = card.querySelector('.tweet-media-img');
  if (t.media_url && !mediaImg) {
    const textNode = card.querySelector('.tweet-text');
    if (textNode) {
      textNode.insertAdjacentHTML('afterend', `
        <div class="tweet-media-container" onclick="event.stopPropagation(); openLightbox('${t.media_url}')">
          <img src="${t.media_url}" alt="Tweet media" class="tweet-media-img" loading="lazy" />
        </div>
      `);
    }
  } else if (mediaImg && t.media_url && mediaImg.getAttribute('src') !== t.media_url) {
    mediaImg.src = t.media_url;
  } else if (mediaImg && !t.media_url) {
    const container = card.querySelector('.tweet-media-container');
    if (container) container.remove();
  }
}

function updateUserProfileHeaderInPlace(user) {
  if (!user) return;
  const nameEls = [document.getElementById('profileFullName'), document.getElementById('headerProfileName')];
  nameEls.forEach(el => {
    if (el) el.innerHTML = `${escapeHtml(user.name)} ${Icons.verifiedBlue} ${Icons.affiliateX}`;
  });
  const handleEl = document.getElementById('profileHandle');
  if (handleEl) handleEl.textContent = user.handle;
  const bioEl = document.getElementById('profileBio');
  if (bioEl && user.bio !== undefined) bioEl.innerHTML = formatTweetText(user.bio);
  const locEl = document.getElementById('profileLocation');
  if (locEl && user.location !== undefined) locEl.textContent = user.location;
  const siteEl = document.getElementById('profileWebsite');
  if (siteEl && user.website !== undefined) {
    siteEl.textContent = user.website.replace(/^https?:\/\//, '');
    siteEl.href = user.website;
  }
  const avEl = document.querySelector('.profile-avatar-img');
  if (avEl && user.avatar_url && avEl.getAttribute('src') !== user.avatar_url) {
    avEl.src = user.avatar_url;
  }
  const bannerEl = document.querySelector('.profile-banner-img');
  if (bannerEl && user.banner_url && bannerEl.getAttribute('src') !== user.banner_url) {
    bannerEl.src = user.banner_url;
  }
}


// Generate HTML for a single Tweet Card
function renderTweetCard(tweet) {
  const verifiedBadge = tweet.verified_type === 'gold' 
    ? Icons.verifiedGold 
    : (tweet.is_verified ? Icons.verifiedBlue : '');
  const affiliateBadge = tweet.is_affiliate ? Icons.affiliateX : '';

  // Pinned badge header
  const pinnedHeader = tweet.is_pinned ? `
    <div class="tweet-pinned-badge">
      ${Icons.pin} Pinned
    </div>
  ` : '';

  // Replying context header
  const replyContext = tweet.reply_to_tweet ? `
    <div class="tweet-reply-context">
      Replying to <a href="javascript:void(0);" onclick="event.stopPropagation(); openThreadModal(${tweet.reply_to_tweet.id})">${tweet.reply_to_tweet.handle}</a>
    </div>
  ` : '';

  // Media embed
  let mediaHtml = '';
  if (tweet.media_url) {
    mediaHtml = `
      <div class="tweet-media-container" onclick="event.stopPropagation(); openLightbox('${tweet.media_url}')">
        <img src="${tweet.media_url}" alt="Tweet media" class="tweet-media-img" loading="lazy" onerror="this.onerror=null;this.src='assets/images/spacex_starship.jpg';" />
      </div>
    `;
  }

  // Quote tweet embed
  let quoteHtml = '';
  if (tweet.quote_tweet) {
    const q = tweet.quote_tweet;
    quoteHtml = `
      <div class="quote-tweet-box" onclick="event.stopPropagation(); openThreadModal(${q.id})">
        <div class="quote-header">
          <img src="${q.avatar_url}" alt="${q.name}" class="quote-avatar" onerror="this.onerror=null;this.src='assets/images/elon_avatar.jpg';" />
          <span class="quote-name">${q.name}</span>
          ${q.verified_type === 'gold' ? Icons.verifiedGold : (q.is_verified ? Icons.verifiedBlue : '')}
          <span class="quote-handle">${q.handle}</span>
          <span class="tweet-dot-separator static-separator" onclick="event.stopPropagation(); event.preventDefault(); return false;">Â·</span>
          <span class="quote-handle static-timestamp" onclick="event.stopPropagation(); event.preventDefault(); return false;">${q.time_ago}</span>
        </div>
        <div class="quote-content">${formatTweetText(q.content)}</div>
      </div>
    `;
  }

  // Promo discount card removed per user request
  let promoHtml = '';

  // Poll embed
  let pollHtml = '';
  if (tweet.poll) {
    pollHtml = renderPollComponent(tweet.poll, tweet.id);
  }

  return `
    <div class="tweet-card" id="tweet-${tweet.id}" onclick="openThreadModal(${tweet.id})">
      <div class="tweet-avatar-col">
        <img src="${tweet.avatar_url}" alt="${tweet.name}" class="tweet-avatar" onerror="this.onerror=null;this.src='assets/images/elon_avatar.jpg';" onclick="event.stopPropagation(); viewUserProfile('${tweet.handle}')" />
      </div>
      <div class="tweet-body-col">
        ${pinnedHeader}
        <div class="tweet-header">
          <div class="tweet-author-info">
            <span class="tweet-author-name">${tweet.name}</span>
            ${verifiedBadge}
            ${affiliateBadge}
            <span class="tweet-author-handle">${tweet.handle}</span>
            <span class="tweet-dot-separator static-separator" onclick="event.stopPropagation(); event.preventDefault(); return false;">Â·</span>
            <span class="tweet-timestamp static-timestamp" onclick="event.stopPropagation(); event.preventDefault(); return false;" title="Published ${escapeHtml(tweet.formatted_date || tweet.time_ago)}">${tweet.time_ago}</span>
          </div>
          <div class="btn-tweet-menu static-dots" onclick="event.stopPropagation(); event.preventDefault(); return false;" aria-hidden="true">
            ${Icons.dots}
          </div>
        </div>
        ${replyContext}
        <div class="tweet-text">${formatTweetText(tweet.content)}</div>
        ${promoHtml}
        ${mediaHtml}
        ${quoteHtml}
        ${pollHtml}
        <div class="tweet-actions-bar">
          <!-- Comments (Display Only / Non-clickable) -->
          <div class="action-btn reply static-metric" title="Comments: ${Number(tweet.replies_count).toLocaleString()}">
            <div class="action-icon-circle">${Icons.reply}</div>
            <span class="action-count">${formatNumber(tweet.replies_count)}</span>
          </div>

          <!-- Reposts (Display Only / Non-clickable) -->
          <div class="action-btn retweet static-metric" title="Reposts: ${Number(tweet.retweets_count).toLocaleString()}">
            <div class="action-icon-circle">${Icons.retweet}</div>
            <span class="action-count">${formatNumber(tweet.retweets_count)}</span>
          </div>

          <!-- Likes (Clickable & Fully Functional) -->
          <div class="action-btn like ${tweet.is_liked ? 'active' : ''}" data-tweet-id="${tweet.real_id || tweet.id}" data-likes="${tweet.likes_count || 0}" onclick="event.stopPropagation(); toggleInteract('like', ${tweet.real_id || tweet.id}, this)" title="${tweet.is_liked ? 'Unlike' : 'Like'} (${Number(tweet.likes_count || 0).toLocaleString()})">
            <div class="action-icon-circle">${tweet.is_liked ? Icons.likeFilled : Icons.like}</div>
            <span class="action-count">${formatNumber(tweet.likes_count)}</span>
          </div>

          <!-- Views (Display Only / Non-clickable) -->
          <div class="action-btn views static-metric" title="Views: ${Number(tweet.views_count).toLocaleString()}">
            <div class="action-icon-circle">${Icons.views}</div>
            <span class="action-count">${formatNumber(tweet.views_count)}</span>
          </div>

          <!-- Bookmarks (Display Only / Non-clickable) -->
          <div class="action-btn bookmark static-metric" title="Bookmark">
            <div class="action-icon-circle">${tweet.is_bookmarked ? Icons.bookmarksFilled : Icons.bookmarks}</div>
          </div>

          <!-- Share (Display Only / Non-clickable) -->
          <div class="action-btn share static-metric" title="Share">
            <div class="action-icon-circle">${Icons.share}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render Interactive Poll
function renderPollComponent(poll, tweetId) {
  const optionsHtml = poll.options.map(opt => {
    const isVoted = poll.voted_option_id === opt.id;
    if (poll.has_voted) {
      return `
        <div class="poll-option-btn" style="cursor:default;">
          <div class="poll-result-bar" style="width:${opt.percentage}%;"></div>
          <span class="poll-option-text">${escapeHtml(opt.option_text)} ${isVoted ? 'âœ“' : ''}</span>
          <span class="poll-option-percent">${opt.percentage}%</span>
        </div>
      `;
    } else {
      return `
        <button class="poll-option-btn" onclick="event.stopPropagation(); castPollVote(${poll.id}, ${opt.id}, ${tweetId})">
          <span class="poll-option-text">${escapeHtml(opt.option_text)}</span>
        </button>
      `;
    }
  }).join('');

  return `
    <div class="tweet-poll-box" id="poll-${poll.id}">
      ${optionsHtml}
      <div class="poll-meta-footer">${formatNumber(poll.total_votes)} votes Â· Final results</div>
    </div>
  `;
}

// Cast Vote on Poll
async function castPollVote(pollId, optionId, tweetId) {
  try {
    const res = await fetch('api/interact.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'poll_vote', poll_id: pollId, option_id: optionId })
    });
    const data = await res.json();
    if (data.success && data.poll) {
      const pollBox = document.getElementById(`poll-${pollId}`);
      if (pollBox) {
        pollBox.outerHTML = renderPollComponent(data.poll, tweetId);
      }
      showToast('Vote counted!');
    } else {
      showToast(data.error || 'Failed to submit vote');
    }
  } catch (err) {
    console.error('Poll vote error:', err);
  }
}

// Toggle Like, Retweet, Bookmark
function toggleInteract(action, tweetId, btnEl) {
  if (!btnEl) return;
  const countSpan = btnEl.querySelector('.action-count');
  const iconCircle = btnEl.querySelector('.action-icon-circle');

  if (action === 'like') {
    const wasLiked = btnEl.classList.contains('active');
    let count = Number(btnEl.getAttribute('data-likes')) || 50000;
    count = wasLiked ? Math.max(50000, count - 1) : Math.min(60000, count + 1);
    btnEl.classList.toggle('active', !wasLiked);
    btnEl.setAttribute('data-likes', String(count));
    if (countSpan) countSpan.textContent = formatNumber(count);
    if (iconCircle) iconCircle.innerHTML = !wasLiked ? Icons.likeFilled : Icons.like;
    btnEl.title = `${!wasLiked ? 'Unlike' : 'Like'} (${count.toLocaleString()})`;
    showToast(!wasLiked ? 'Liked demo post' : 'Like removed');
    return;
  }

  if (action === 'retweet') {
    const wasActive = btnEl.classList.contains('active');
    const countEl = btnEl.querySelector('.action-count');
    const raw = countEl ? countEl.textContent : '50K';
    let count = raw.endsWith('K') ? Math.round(parseFloat(raw) * 1000) : Number(raw.replace(/,/g, '')) || 50000;
    count = wasActive ? Math.max(50000, count - 1) : Math.min(60000, count + 1);
    btnEl.classList.toggle('active', !wasActive);
    if (countEl) countEl.textContent = formatNumber(count);
    showToast(!wasActive ? 'Reposted demo post' : 'Repost removed');
    return;
  }

  if (action === 'bookmark') {
    const active = btnEl.classList.toggle('active');
    if (iconCircle) iconCircle.innerHTML = active ? Icons.bookmarksFilled : Icons.bookmarks;
    showToast(active ? 'Added to demo bookmarks' : 'Removed from demo bookmarks');
  }
}

// Follow / Unfollow Elon Musk or Sidebar User
async function toggleFollowUser(targetUserId, btnEl) {
  try {
    const res = await fetch('api/follow.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: targetUserId })
    });
    const data = await res.json();

    if (data.success) {
      const fLabel = uiButtonsConfig?.btn_follow?.extra_data?.followed_label || 'Following';
      const unfLabel = uiButtonsConfig?.btn_follow?.extra_data?.unfollowed_label || 'Follow';

      if (data.following) {
        btnEl.classList.add('following');
        btnEl.textContent = fLabel;
        showToast('Followed successfully');
      } else {
        btnEl.classList.remove('following');
        btnEl.textContent = unfLabel;
        showToast('Unfollowed');
      }

      if (targetUserId === 1) {
        isElonFollowing = data.following;
        const countEl = document.getElementById('followersCount');
        if (countEl) countEl.textContent = data.formatted_followers;
      }
    }
  } catch (err) {
    console.error('Follow error:', err);
  }
}

// Tab Switching & Navigation Setup
function setupEventListeners() {
  // Only Post tab is working and clickable
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tabKey = btn.getAttribute('data-tab');
    if (tabKey === 'posts' || tabKey === 'post') {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = 'posts';
        loadTweets('posts', false);
      });
    } else {
      btn.style.cursor = 'default';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only the post button is working and clickable and functioning
        return false;
      });
    }
  });

  // Follow Elon Musk Header button
  const btnElonFollow = document.getElementById('btnElonFollow');
  if (btnElonFollow) {
    btnElonFollow.addEventListener('click', () => toggleFollowUser(1, btnElonFollow));
  }

  // Inline Composer textarea input listener
  const composerInput = document.getElementById('inlineComposerText');
  const charRing = document.getElementById('inlineCharRing');
  const btnSubmit = document.getElementById('btnSubmitInline');

  if (composerInput) {
    composerInput.addEventListener('input', () => {
      autoResizeTextarea(composerInput);
      const len = composerInput.value.length;
      const max = 280;
      const progress = Math.min(len / max, 1);
      const circumference = 63;
      const offset = circumference - (progress * circumference);

      if (charRing) {
        charRing.style.strokeDashoffset = offset;
        if (len > 260) {
          charRing.style.stroke = 'var(--twitter-pink)';
        } else if (len > 220) {
          charRing.style.stroke = 'var(--twitter-gold)';
        } else {
          charRing.style.stroke = 'var(--twitter-blue)';
        }
      }

      const mediaPreview = document.getElementById('mediaPreviewImg');
      btnSubmit.disabled = (len === 0 && !(mediaPreview && mediaPreview.src));
    });
  }

  // Search input live suggestions
  const searchInput = document.getElementById('rightSearchInput');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleSearch(searchInput.value), 250);
    });
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) {
        document.getElementById('searchResultsDropdown').style.display = 'flex';
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-wrapper')) {
        const dropdown = document.getElementById('searchResultsDropdown');
        if (dropdown) dropdown.style.display = 'none';
      }
      if (!e.target.closest('#profileOptionsMenu') && !e.target.closest('[data-icon="dots"]')) {
        const menu = document.getElementById('profileOptionsMenu');
        if (menu) menu.style.display = 'none';
      }
    });
  }
}

// Live Search Handler
async function handleSearch(query) {
  const dropdown = document.getElementById('searchResultsDropdown');
  if (!query.trim()) {
    dropdown.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`api/search.php?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success) {
      let html = '';
      if (data.users.length > 0) {
        html += '<div style="padding:8px 16px; font-size:13px; font-weight:700; color:var(--text-secondary);">PEOPLE</div>';
        html += data.users.map(u => `
          <div class="search-result-item" onclick="viewUserProfile('${u.handle}')">
            <img src="${u.avatar_url}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" onerror="this.src='assets/images/guest_avatar.jpg';" />
            <div>
              <div style="font-weight:700; color:var(--text-primary); font-size:14px;">${u.name}</div>
              <div style="color:var(--text-secondary); font-size:13px;">${u.handle}</div>
            </div>
          </div>
        `).join('');
      }
      if (data.tweets.length > 0) {
        html += '<div style="padding:8px 16px; font-size:13px; font-weight:700; color:var(--text-secondary); border-top:1px solid var(--border-subtle);">POSTS</div>';
        html += data.tweets.map(t => `
          <div class="search-result-item" onclick="openThreadModal(${t.id})">
            <div>
              <div style="font-weight:700; font-size:13px; color:var(--text-secondary);">${t.name} ${t.handle}</div>
              <div style="font-size:14px; color:var(--text-primary); margin-top:2px;">${escapeHtml(t.content)}</div>
            </div>
          </div>
        `).join('');
      }

      if (!html) {
        html = '<div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:14px;">No results found</div>';
      }

      dropdown.innerHTML = html;
      dropdown.style.display = 'flex';
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

// Submit New Post (Inline Composer)
async function submitInlinePost() {
  const textarea = document.getElementById('inlineComposerText');
  const content = textarea.value.trim();
  const authorSelect = document.getElementById('composerAuthorSelect');
  const asElon = authorSelect ? (authorSelect.value === 'elon') : false;

  const mediaImg = document.getElementById('mediaPreviewImg');
  const mediaUrl = (mediaImg && mediaImg.src && mediaImg.style.display !== 'none') ? mediaImg.src : null;

  // Check if poll is active
  let pollOptions = null;
  const pollCard = document.getElementById('pollBuilderCard');
  if (pollCard && pollCard.style.display !== 'none') {
    const opt1El = document.getElementById('pollOpt1');
    const opt2El = document.getElementById('pollOpt2');
    const opt1 = opt1El ? opt1El.value.trim() : '';
    const opt2 = opt2El ? opt2El.value.trim() : '';
    if (opt1 && opt2) {
      pollOptions = [opt1, opt2];
    }
  }

  if (!content && !mediaUrl && !pollOptions) return;

  try {
    const res = await fetch('api/create_tweet.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content,
        media_url: mediaUrl,
        as_elon: asElon,
        poll_options: pollOptions
      })
    });
    const data = await res.json();

    if (data.success) {
      textarea.value = '';
      removeMediaPreview();
      removePollBuilder();
      const btnSub = document.getElementById('btnSubmitInline');
      if (btnSub) btnSub.disabled = true;
      showToast('Your post was sent.');
      loadTweets(currentTab, false);
    } else {
      showToast(data.error || 'Failed to post');
    }
  } catch (err) {
    console.error('Post creation error:', err);
  }
}

// Media / Image Attachment Trigger
function triggerMediaUpload() {
  const defaultImages = [
    'assets/images/spacex_starship.jpg',
    'assets/images/tesla_optimus.jpg',
    'assets/images/cybertruck.jpg',
    'assets/images/grok_ai.jpg'
  ];
  const chosen = defaultImages[Math.floor(Math.random() * defaultImages.length)];
  const preview = document.getElementById('composerMediaPreview');
  const img = document.getElementById('mediaPreviewImg');
  if (preview && img) {
    img.src = chosen;
    img.style.display = 'block';
    preview.style.display = 'block';
    const btnSub = document.getElementById('btnSubmitInline');
    if (btnSub) btnSub.disabled = false;
  }
}

function removeMediaPreview() {
  const preview = document.getElementById('composerMediaPreview');
  const img = document.getElementById('mediaPreviewImg');
  if (preview && img) {
    img.src = '';
    preview.style.display = 'none';
  }
}

// Poll Builder Trigger
function togglePollBuilder() {
  const card = document.getElementById('pollBuilderCard');
  if (card) {
    card.style.display = card.style.display === 'none' || !card.style.display ? 'flex' : 'none';
  }
}
function removePollBuilder() {
  const card = document.getElementById('pollBuilderCard');
  if (card) {
    card.style.display = 'none';
    const opt1 = document.getElementById('pollOpt1');
    const opt2 = document.getElementById('pollOpt2');
    if (opt1) opt1.value = '';
    if (opt2) opt2.value = '';
  }
}

// Emoji Drawer Toggle & Insertion
function toggleEmojiDrawer() {
  const drawer = document.getElementById('emojiDrawer');
  if (drawer) {
    drawer.style.display = drawer.style.display === 'none' || !drawer.style.display ? 'flex' : 'none';
  }
}

function insertEmoji(emoji) {
  const textarea = document.getElementById('inlineComposerText');
  if (textarea) {
    textarea.value += emoji;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  }
}

// Navigation helpers
function navigateToHome() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const postTabBtn = document.querySelector('.tab-btn[data-tab="posts"]');
  if (postTabBtn) postTabBtn.click();
  showToast('Refreshed feed');
}

function openExplore() {
  const searchInput = document.getElementById('rightSearchInput');
  if (searchInput) {
    searchInput.focus();
    showToast('Search trends & posts');
  }
}

// Grok 3 AI Modal logic
function openGrokModal() {
  document.getElementById('grokModal').style.display = 'flex';
}
function closeGrokModal() {
  document.getElementById('grokModal').style.display = 'none';
}

function askGrokPreset(prompt) {
  document.getElementById('grokInputText').value = prompt;
  sendGrokMessage();
}

function sendGrokMessage() {
  const input = document.getElementById('grokInputText');
  const text = input.value.trim();
  if (!text) return;

  const container = document.getElementById('grokMessagesContainer');
  container.insertAdjacentHTML('beforeend', `
    <div style="background:rgba(29,155,240,0.15); padding:10px 14px; border-radius:16px; align-self:flex-end; font-size:14px; color:var(--text-primary); max-width:85%;">
      ${escapeHtml(text)}
    </div>
  `);
  input.value = '';
  container.scrollTop = container.scrollHeight;

  // Grok smart response simulation
  setTimeout(() => {
    let answer = "Grok 3: That is a fascinating physics question! At current iteration speed, neural nets and raptor engines are reaching frontier limits. We are engineering for maximum civilizational progress! ðŸš€";
    if (text.toLowerCase().includes('mars') || text.toLowerCase().includes('starship')) {
      answer = "Grok 3: The transfer window opens every 26 months. Uncrewed Starships will test EDL (Entry, Descent, Landing) on Mars first. If those land safely, human city founding starts shortly after!";
    } else if (text.toLowerCase().includes('optimus') || text.toLowerCase().includes('robot')) {
      answer = "Grok 3: Optimus leverages Tesla's end-to-end vision neural net. Economies of scale will drop unit production below $20K, transforming global productivity into limitless abundance.";
    } else if (text.toLowerCase().includes('grok')) {
      answer = "Grok 3: Grok is trained on Colossus (100k H100s) and designed to understand reality without ideological bias. Always seeking ground truth!";
    }

    container.insertAdjacentHTML('beforeend', `
      <div style="background:var(--bg-secondary); padding:12px 16px; border-radius:16px; border:1px solid var(--border-color); font-size:14px; line-height:1.4;">
        <strong style="color:var(--twitter-purple);">Grok:</strong> ${answer}
      </div>
    `);
    container.scrollTop = container.scrollHeight;
  }, 400);
}

// ==========================================================================
// GROK AI SEARCH ENGINE WIDGET (RIGHT SIDEBAR)
// ==========================================================================
function quickGrokSearch(query) {
  const input = document.getElementById('grokEngineInput');
  if (input) {
    input.value = query;
    executeGrokSearch();
  }
}

function clearGrokSearch() {
  const box = document.getElementById('grokEngineResultBox');
  const input = document.getElementById('grokEngineInput');
  if (box) box.style.display = 'none';
  if (input) input.value = '';
}

async function executeGrokSearch() {
  const input = document.getElementById('grokEngineInput');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;

  const box = document.getElementById('grokEngineResultBox');
  const answerEl = document.getElementById('grokEngineAnswerText');
  const matchesEl = document.getElementById('grokEngineMatches');

  if (box) box.style.display = 'block';
  if (answerEl) answerEl.innerHTML = `<span style="color:#c084fc; display:inline-flex; align-items:center; gap:6px;"><span>âš¡</span> Grok 3 searching neural index &amp; timeline...</span>`;
  if (matchesEl) matchesEl.innerHTML = '';

  try {
    // 1. Check live search API for real database matches (tweets / accounts)
    let dbMatches = [];
    try {
      const res = await fetch(`api/search.php?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data && data.success) {
        dbMatches = data.tweets || [];
      }
    } catch (e) {}

    // 2. Generate intelligent first-principles Grok answer
    const qLower = q.toLowerCase();
    let aiAnswer = '';

    if (qLower.includes('starship') || qLower.includes('flight') || qLower.includes('spacex')) {
      aiAnswer = `ðŸš€ **SpaceX Starship Analysis:**\nStarship Flight 7 advances full reusability with upper stage catch attempts at Starbase Mechazilla towers. Raptor 3 engines operate at 350 bar chamber pressure with zero heat shielding required on hot-staging ring. Payload capability: 150+ tons to LEO.`;
    } else if (qLower.includes('fsd') || qLower.includes('tesla') || qLower.includes('cybercab') || qLower.includes('autonomy')) {
      aiAnswer = `âš¡ **Tesla FSD v13 & Robotaxi:**\nFSD v13 introduces 36x parameter compute scaling, native end-to-end vision neural nets for parking, reversing, and complex city scenarios without brittle heuristics. Unsupervised Cybercab deployment targeting initial regulatory pilots in 2025-2026.`;
    } else if (qLower.includes('grok') || qLower.includes('xai') || qLower.includes('colossus')) {
      aiAnswer = `ðŸ¤– **xAI Grok 3 Neural Engine:**\nGrok 3 was trained on the Memphis Colossus supercluster (100,000 liquid-cooled NVIDIA H100s). Features state-of-the-art reasoning across mathematics, live multimodal parsing of real-time ð• telemetry, and an unwavering commitment to ground truth.`;
    } else if (qLower.includes('discount') || qLower.includes('promo') || qLower.includes('code') || qLower.includes('sale') || qLower.includes('25%')) {
      aiAnswer = `ðŸ·ï¸ **Official 25% Ecosystem Discount:**\nClaim code **ELON25** for 25% off across all verified products (Tesla Cybertruck AWD, Starlink Mini hardware kits, Grok 3 Ultra annual memberships, and Boring Company gear). Pinned on post #1 of Elon's timeline!`;
    } else if (qLower.includes('mars') || qLower.includes('planet') || qLower.includes('colony')) {
      aiAnswer = `ðŸª **Mars City Architecture:**\nTo establish a self-sustaining city of 1M people on Mars within 20-30 years requires roughly 1,000 Starship flights per 26-month orbital sync. Key priority: local propellant production (Sabatier reaction combining atmospheric CO2 and water ice to create liquid CH4 and LOX).`;
    } else if (qLower.includes('optimus') || qLower.includes('robot')) {
      aiAnswer = `ðŸ¦¾ **Optimus Humanoid Robot:**\nOptimus Gen 2 features 22 DoF hands with tactile sensors and custom Tesla-designed actuators. Unit production cost is designed to scale below $20,000, unlocking an economy of post-scarcity abundance.`;
    } else if (qLower.includes('boring') || qLower.includes('tunnel')) {
      aiAnswer = `ðŸš‡ **The Boring Company Loop:**\nPrufrock 4 tunneling machines can mine faster than a snail crawling (>7 miles per day goal), solving soul-destroying traffic with 3D all-weather electric subterranean transit.`;
    } else if (qLower.includes('neuralink') || qLower.includes('telepathy') || qLower.includes('blindsight')) {
      aiAnswer = `ðŸ§  **Neuralink Telepathy & Blindsight:**\nNeuralink N1 implant utilizes 1,024 ultra-fine electrodes across 64 threads. Telepathy allows direct digital neural interface for patients, while Blindsight aims to restore vision even for individuals blind from birth.`;
    } else {
      aiAnswer = `âœ¦ **Grok 3 Search Result:**\nExamining first-principles physics and live timeline telemetry for "${q}":\nTruth-seeking neural index indicates high correlation with accelerating technological singularity and multiplanetary progress.`;
    }

    // Format Markdown-like bold text
    let formattedHtml = escapeHtml(aiAnswer)
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#eff3f4;">$1</strong>')
      .replace(/\n/g, '<br/>');

    if (answerEl) {
      answerEl.innerHTML = formattedHtml;
    }

    // Show matching posts if any
    if (matchesEl) {
      if (dbMatches.length > 0) {
        matchesEl.innerHTML = `
          <div style="font-size:11px; font-weight:800; color:#1d9bf0; margin-top:8px; margin-bottom:4px; text-transform:uppercase;">
            Related Posts on Timeline (${dbMatches.length}):
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${dbMatches.slice(0, 2).map(t => `
              <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer;" onclick="window.scrollTo({top:0, behavior:'smooth'})">
                <span style="color:#9ca3af; font-size:11px;">@${escapeHtml(t.handle)}:</span> 
                <span style="color:#eff3f4;">${escapeHtml(t.content.length > 80 ? t.content.substring(0, 77) + '...' : t.content)}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        matchesEl.innerHTML = '';
      }
    }

  } catch (err) {
    if (answerEl) answerEl.textContent = 'Grok Search Error: ' + err.message;
  }
}

// Notifications Modal
function openNotificationsModal() {
  document.getElementById('notificationsModal').style.display = 'flex';
}
function closeNotificationsModal() {
  document.getElementById('notificationsModal').style.display = 'none';
}

// ==========================================================================
// AUTHENTIC ð• CONNECTIONS MODAL (FOLLOWERS, FOLLOWING, VERIFIED, SUBSCRIPTIONS)
// ==========================================================================
let currentConnectionsTab = 'followers';
let connectionsSearchDebounce = null;

function openConnectionsModal(tab = 'followers') {
  currentConnectionsTab = tab;
  const modal = document.getElementById('connectionsModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const searchInput = document.getElementById('connectionsSearchInput');
  if (searchInput) searchInput.value = '';

  switchConnectionsTab(tab);
}

function openFollowingModal() {
  openConnectionsModal('following');
}

function openFollowersModal() {
  openConnectionsModal('followers');
}

function closeConnectionsModal() {
  const modal = document.getElementById('connectionsModal');
  if (modal) modal.style.display = 'none';
}

function switchConnectionsTab(tab) {
  currentConnectionsTab = tab;
  
  // Update tab buttons active state
  ['Verified', 'Followers', 'Following', 'Subscriptions'].forEach(t => {
    const btn = document.getElementById(`tabBtn${t}`);
    if (btn) {
      if (t.toLowerCase() === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  const searchInput = document.getElementById('connectionsSearchInput');
  const query = searchInput ? searchInput.value.trim() : '';
  loadConnectionsData(tab, query);
}

function handleConnectionsSearch(query) {
  clearTimeout(connectionsSearchDebounce);
  connectionsSearchDebounce = setTimeout(() => {
    loadConnectionsData(currentConnectionsTab, query.trim());
  }, 220);
}

async function loadConnectionsData(tab, search = '') {
  const body = document.getElementById('connectionsModalBody');
  if (!body) return;

  // Show modern shimmer loader
  body.innerHTML = `
    <div style="padding: 24px 16px; display: flex; flex-direction: column; gap: 18px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:44px; height:44px; border-radius:50%; background:#202327; animation:pulse 1.5s infinite;"></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div style="width:120px; height:14px; border-radius:4px; background:#202327; animation:pulse 1.5s infinite;"></div>
          <div style="width:80px; height:12px; border-radius:4px; background:#16181c; animation:pulse 1.5s infinite;"></div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:44px; height:44px; border-radius:50%; background:#202327; animation:pulse 1.5s infinite;"></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div style="width:140px; height:14px; border-radius:4px; background:#202327; animation:pulse 1.5s infinite;"></div>
          <div style="width:90px; height:12px; border-radius:4px; background:#16181c; animation:pulse 1.5s infinite;"></div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await fetch(`api/follow.php?tab=${encodeURIComponent(tab)}&user_id=1&q=${encodeURIComponent(search)}`);
    const data = await res.json();

    if (!data.success) {
      body.innerHTML = `<div style="padding:32px; text-align:center; color:#71767b;">Failed to load accounts.</div>`;
      return;
    }

    // Update tab labels with live counts
    if (data.counts) {
      const followersBtn = document.getElementById('tabBtnFollowers');
      const followingBtn = document.getElementById('tabBtnFollowing');
      const verifiedBtn = document.getElementById('tabBtnVerified');
      const subsBtn = document.getElementById('tabBtnSubscriptions');

      if (followersBtn) followersBtn.textContent = `Followers (${data.counts.formatted_followers})`;
      if (followingBtn) followingBtn.textContent = `Following (${data.counts.formatted_following})`;
      if (verifiedBtn) verifiedBtn.textContent = `Verified`;
      if (subsBtn) subsBtn.textContent = `Subscriptions (${data.counts.subscriptions_count})`;

      // Also update Elon's profile header stats
      const elonFollowersStat = document.getElementById('followersCount');
      const elonFollowingStat = document.getElementById('followingCount');
      if (elonFollowersStat) elonFollowersStat.textContent = data.counts.formatted_followers;
      if (elonFollowingStat) elonFollowingStat.textContent = data.counts.formatted_following;
    }

    if (!data.users || data.users.length === 0) {
      body.innerHTML = `
        <div style="padding:48px 24px; text-align:center;">
          <div style="font-size:22px; font-weight:800; color:#eff3f4; margin-bottom:8px;">No accounts found</div>
          <div style="font-size:14px; color:#71767b;">Looking for accounts in this category? Try searching by name or handle.</div>
        </div>
      `;
      return;
    }

    // Render user items with authentic badges, bios, and interactive follow buttons
    body.innerHTML = data.users.map(u => {
      const verifiedBadge = u.verified_type === 'gold' 
        ? Icons.verifiedGold 
        : (u.is_verified ? Icons.verifiedBlue : '');
      const affiliateBadge = u.is_affiliate ? Icons.affiliateX : '';
      const followsYouBadge = u.follows_you ? `<span class="badge-follows-you">Follows you</span>` : '';

      const btnClass = u.is_following ? 'btn-action-follow is-following' : 'btn-action-follow is-not-following';
      const btnText = u.is_following ? 'Following' : 'Follow';

      return `
        <div class="conn-user-item" onclick="viewUserProfile('${u.handle}')">
          <img src="${u.avatar_url}" alt="${u.name}" class="conn-avatar" onerror="this.src='assets/images/elon_avatar.jpg';" />
          <div class="conn-info-col">
            <div class="conn-name-row">
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</span>
              ${verifiedBadge}
              ${affiliateBadge}
            </div>
            <div class="conn-handle-row">
              <span>${u.handle}</span>
              ${followsYouBadge}
            </div>
            ${u.bio ? `<div class="conn-bio-snippet">${formatTweetText(u.bio)}</div>` : ''}
          </div>
          ${!u.is_self ? `
            <button class="${btnClass}" onclick="event.stopPropagation(); toggleFollowUser(${u.id}, this)">
              ${btnText}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    body.innerHTML = `<div style="padding:32px; text-align:center; color:#f4212e;">Error connecting to ð• network.</div>`;
  }
}

async function toggleFollowUser(targetUserId, btnEl) {
  if (!btnEl) return;
  const isCurrentlyFollowing = btnEl.classList.contains('is-following');
  
  // Optimistic UI toggle
  if (isCurrentlyFollowing) {
    btnEl.classList.remove('is-following');
    btnEl.classList.add('is-not-following');
    btnEl.textContent = 'Follow';
  } else {
    btnEl.classList.remove('is-not-following');
    btnEl.classList.add('is-following');
    btnEl.textContent = 'Following';
  }

  try {
    const res = await fetch('api/follow.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: targetUserId })
    });
    const data = await res.json();

    if (data.success) {
      // Reconcile button state
      if (data.following) {
        btnEl.classList.remove('is-not-following');
        btnEl.classList.add('is-following');
        btnEl.textContent = 'Following';
      } else {
        btnEl.classList.remove('is-following');
        btnEl.classList.add('is-not-following');
        btnEl.textContent = 'Follow';
      }

      // If target is Elon Musk (or targetUserId === 1), animate follower rolling bump
      if (targetUserId === 1) {
        const followersCountEl = document.getElementById('followersCount');
        if (followersCountEl) {
          followersCountEl.textContent = data.formatted_followers;
          followersCountEl.classList.remove('animate-bump');
          void followersCountEl.offsetWidth; // trigger reflow
          followersCountEl.classList.add('animate-bump');
        }
        // Also update big follow button on profile
        const btnElonFollow = document.getElementById('btnElonFollow');
        if (btnElonFollow) {
          if (data.following) {
            btnElonFollow.classList.add('following');
            btnElonFollow.textContent = 'Following';
          } else {
            btnElonFollow.classList.remove('following');
            btnElonFollow.textContent = 'Follow';
          }
        }
      }
    } else {
      showToast(data.error || 'Failed to update follow status');
    }
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 25% DISCOUNT PROMOTION & PRODUCT DEALS MODAL
// ==========================================================================
async function openDiscountDealsModal() {
  const modal = document.getElementById('discountDealsModal');
  const grid = document.getElementById('dealsGridContainer');
  if (!modal || !grid) return;

  grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:32px; color:#71767b;">Loading discounted catalog...</div>`;
  modal.style.display = 'flex';

  try {
    const res = await fetch('api/discount.php');
    const data = await res.json();

    if (data.success && data.products && data.products.length > 0) {
      grid.innerHTML = data.products.map(p => `
        <div class="deal-card">
          <img src="${p.image}" alt="${p.name}" class="deal-thumb" onerror="this.src='assets/images/cybertruck.jpg'" />
          <div class="deal-info">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span class="deal-category">${p.category}</span>
              <span style="font-size:11px; font-weight:800; color:#fbbf24; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:4px;">${p.badge}</span>
            </div>
            <div class="deal-name">${p.name}</div>
            <div style="font-size:13px; color:#9ca3af; margin-bottom:10px; line-height:1.3;">${p.description}</div>
            <div class="deal-prices-row">
              <span class="deal-discounted-price">$${Number(p.discounted_price).toLocaleString()}</span>
              <span class="deal-orig-price">$${Number(p.original_price).toLocaleString()}</span>
              <span style="font-size:12px; color:#10b981; font-weight:700; margin-left:auto;">${p.savings}</span>
            </div>
            <button class="btn-order-deal" onclick="orderProductDeal('${escapeHtml(p.name)}', '${Number(p.discounted_price).toLocaleString()}')">
              Apply 25% Discount &amp; Order
            </button>
          </div>
        </div>
      `).join('');
    } else {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:32px; color:#71767b;">No active deals currently available.</div>`;
    }
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:32px; color:#f4212e;">Failed to load deals catalog.</div>`;
  }
}

function closeDiscountDealsModal() {
  const modal = document.getElementById('discountDealsModal');
  if (modal) modal.style.display = 'none';
}

function copyPromoCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    showToast(`ðŸŽ‰ Copied code ${code}! 25% discount activated.`);
  }).catch(() => {
    showToast(`Promo code: ${code}`);
  });
}

function orderProductDeal(name, price) {
  showToast(`ðŸ›’ Order placed for ${name} at $${price} (25% off applied)!`);
}

// ==========================================================================
// CONNECTED REAL-TIME MESSAGING CLIENT (AUTHENTIC ð• MESSAGE BOX)
// ==========================================================================
let liveMessagingInterval = null;
let lastMessageCount = 0;
let isChatAudioAllowed = false;

function toggleDockedChat() {
  const drawer = document.getElementById('dockedChatDrawer');
  if (!drawer) return;
  const isCollapsed = drawer.classList.contains('collapsed');
  const chevron = document.getElementById('dockedChevronIcon');

  if (isCollapsed) {
    drawer.classList.remove('collapsed');
    drawer.classList.add('expanded');
    if (chevron) {
      chevron.innerHTML = '<path d="M12 16.414l-7.293-7.293 1.414-1.414L12 13.586l5.879-5.879 1.414 1.414z"/>';
    }
    fetchLiveMessages(true);
    // Mark messages as read
    fetch('api/messages.php?action=mark_read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: 1 })
    }).catch(() => {});
    const badge = document.getElementById('dockedUnreadBadge');
    if (badge) badge.style.display = 'none';
    const input = document.getElementById('dockedChatInput');
    if (input) setTimeout(() => input.focus(), 150);
  } else {
    drawer.classList.remove('expanded');
    drawer.classList.add('collapsed');
    if (chevron) {
      chevron.innerHTML = '<path d="M12 7.586l7.293 7.293-1.414 1.414L12 10.414l-5.879 5.879-1.414-1.414z"/>';
    }
  }
}

function startNewChatMessage() {
  const drawer = document.getElementById('dockedChatDrawer');
  if (drawer && drawer.classList.contains('collapsed')) {
    toggleDockedChat();
  }
  const input = document.getElementById('dockedChatInput');
  if (input) input.focus();
}

// Opens the authentic Twitter / X Message Box directly in-page modal
function openTwitterMessageBox() {
  openMessagesModal();
  const mInput = document.getElementById('modalChatInput');
  if (mInput) setTimeout(() => mInput.focus(), 150);
}

// Seamlessly transition between docked floating drawer and full modal view
function popoutToModalChat() {
  const drawer = document.getElementById('dockedChatDrawer');
  if (drawer) {
    drawer.classList.remove('expanded');
    drawer.classList.add('collapsed');
    const chevron = document.getElementById('dockedChevronIcon');
    if (chevron) {
      chevron.innerHTML = '<path d="M12 7.586l7.293 7.293-1.414 1.414L12 10.414l-5.879 5.879-1.414-1.414z"/>';
    }
  }
  openMessagesModal();
  const input = document.getElementById('modalChatInput');
  if (input) setTimeout(() => input.focus(), 150);
}

function dockFromModalChat() {
  closeMessagesModal();
  openTwitterMessageBox();
}

// ==========================================================================
// REAL-TIME AUDIO & INTERACTIVE NOTIFICATIONS (ADMIN MESSAGES)
// ==========================================================================

let audioCtx = null;
function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Ensure audio context is ready on first user interaction
['click', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, () => {
    initAudioContext();
  }, { once: true, passive: true });
});

// Crisp dual-tone chime (E5 -> B5) synthesized cleanly via Web Audio API
function playMessageNotificationChime() {
  try {
    initAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Note 1: E5 (659.25 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2: B5 (987.77 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.28, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.48);
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

// Floating Toast Notification Card
function showFloatingMessageAlert(msg) {
  if (!msg) return;
  const container = document.getElementById('msgNotificationContainer');
  if (!container) return;

  const cardId = `msgAlert_${msg.id}`;
  if (document.getElementById(cardId)) return;

  const card = document.createElement('div');
  card.className = 'msg-alert-card';
  card.id = cardId;

  const senderAvatar = msg.sender_avatar || 'assets/images/elon_avatar.jpg';
  const senderName = msg.sender_name || 'Elon Musk';
  const senderHandle = msg.sender_handle || '@elonmusk';
  const previewText = msg.message || '';
  const timeStr = msg.time_ago || 'Just now';

  card.innerHTML = `
    <div class="msg-alert-header">
      <div class="msg-alert-sender-box">
        <img src="${escapeHtml(senderAvatar)}" class="msg-alert-avatar" alt="${escapeHtml(senderName)}" onerror="this.src='assets/images/elon_avatar.svg'" />
        <div class="msg-alert-sender-info">
          <div class="msg-alert-name-row">
            <span>${escapeHtml(senderName)}</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#1d9bf0"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2l-3.54-3.54 1.41-1.41 2.12 2.12 5.66-5.66 1.41 1.41-7.06 7.08z"/></svg>
          </div>
          <span class="msg-alert-handle">${escapeHtml(senderHandle)}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="msg-alert-badge-live">
          <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block;"></span>
          New Message
        </span>
        <button class="msg-alert-close-btn" onclick="event.stopPropagation(); dismissMessageAlert('${cardId}')" title="Dismiss">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10.59 12L5 6.41 6.41 5 12 10.59 17.59 5 19 6.41 13.41 12 19 17.59 17.59 19 12 13.41 6.41 19 5 17.59 10.59 12z"/></svg>
        </button>
      </div>
    </div>
    <div class="msg-alert-body">
      ${escapeHtml(previewText)}
    </div>
    <div class="msg-alert-actions">
      <span class="msg-alert-time">${escapeHtml(timeStr)}</span>
      <button class="btn-msg-alert-reply" onclick="event.stopPropagation(); dismissMessageAlert('${cardId}'); openTwitterMessageBox();">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 4.8 8-4.8V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.045l-7.485 4.491a1 1 0 0 1-1.03 0L3.998 10.045V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.455z"/></svg>
        Reply Directly
      </button>
    </div>
  `;

  card.addEventListener('click', () => {
    dismissMessageAlert(cardId);
    openTwitterMessageBox();
  });

  container.appendChild(card);

  let timeoutId = setTimeout(() => {
    dismissMessageAlert(cardId);
  }, 9000);

  card.addEventListener('mouseenter', () => clearTimeout(timeoutId));
  card.addEventListener('mouseleave', () => {
    timeoutId = setTimeout(() => dismissMessageAlert(cardId), 4000);
  });
}

function dismissMessageAlert(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.add('fade-out');
  setTimeout(() => {
    if (card && card.parentNode) card.remove();
  }, 300);
}

function clearAllMessageAlerts() {
  const container = document.getElementById('msgNotificationContainer');
  if (container) container.innerHTML = '';
}

// Browser Tab Title Notifier
let originalDocTitle = document.title;
let titleFlashInterval = null;

function flashTitleNotification(senderName = 'Elon Musk') {
  if (titleFlashInterval) return;
  let toggle = false;
  titleFlashInterval = setInterval(() => {
    document.title = toggle ? `(1) ðŸ’¬ Message from ${senderName}` : originalDocTitle;
    toggle = !toggle;
  }, 1200);
}

function resetTitleNotification() {
  if (titleFlashInterval) {
    clearInterval(titleFlashInterval);
    titleFlashInterval = null;
  }
  document.title = originalDocTitle;
}

window.addEventListener('focus', () => {
  const modal = document.getElementById('messagesModal');
  if (modal && modal.style.display !== 'none') {
    resetTitleNotification();
  }
});

function openMessagesModal() {
    const modal = document.getElementById('messagesModal');

    if (modal) {
        modal.style.display = 'flex';

        const profileBadge = document.getElementById('profileMsgBadge');
        if (profileBadge) profileBadge.style.display = 'none';

        if (typeof clearAllMessageAlerts === 'function') {
            clearAllMessageAlerts();
        }

        if (typeof resetTitleNotification === 'function') {
            resetTitleNotification();
        }

        fetchLiveMessages(true);

        const input = document.getElementById('modalChatInput');
        if (input) setTimeout(() => input.focus(), 150);
    }
}

function closeMessagesModal() {
  const modal = document.getElementById('messagesModal');
  if (modal) modal.style.display = 'none';
  resetTitleNotification();
}

async function fetchLiveMessages(forceScroll = false) {
    try {
        if (window.chatReady) {
            await window.chatReady;
        }

        const conversationId = window.currentConversationId;

        if (!conversationId) return;

        const { data: messages, error } = await window.supabaseClient
            .from('messages')
            .select('id, sender_role, body, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const dockedStream = document.getElementById('dockedMessagesStream');
        const modalStream = document.getElementById('modalMessagesStream');

        const html = messages.length > 0
            ? messages.map(message => {
                const fromClass = message.sender_role === 'visitor'
                    ? 'from-me'
                    : 'from-them';

                const time = new Date(message.created_at)
                    .toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                return `
                    <div class="chat-msg-row ${fromClass}">
                        <div class="chat-bubble">
                            ${escapeHtml(message.body)}
                        </div>
                        <span class="chat-msg-time">${time}</span>
                    </div>
                `;
            }).join('')
            : `
                <div style="text-align:center; padding:32px 16px; color:#71767b;">
                    <div style="font-size:16px; font-weight:800; margin-bottom:8px;">
                        Direct Message
                    </div>
                    <div style="font-size:13px; line-height:1.5;">
                        Send a message to the site administrator.
                    </div>
                </div>
            `;

        [dockedStream, modalStream].forEach(stream => {
            if (stream) {
                stream.innerHTML = html;

                if (forceScroll) {
                    stream.scrollTop = stream.scrollHeight;
                }
            }
        });

    } catch (error) {
        console.error('Error loading Supabase messages:', error);
    }
}

let lastNotifiedMessageId = 0;

async function checkUnreadMessages() {
  try {
    const res = await fetch('api/messages.php?action=unread_count', {
      headers: { 'X-Visitor-Id': getOrCreateVisitorId() }
    });
    const data = await res.json();
    if (data.success) {
      const count = data.unread_count || 0;
      const profileBadge = document.getElementById('profileMsgBadge');
      const dockedBadge = document.getElementById('dockedUnreadBadge');
      const sidebarBadge = document.getElementById('sidebarMsgBadge');

      const modal = document.getElementById('messagesModal');
      const isModalOpen = modal && modal.style.display !== 'none';

      // Update badge on Profile DM button
      if (profileBadge) {
        if (count > 0 && !isModalOpen) {
          profileBadge.textContent = count > 99 ? '99+' : count;
          profileBadge.style.display = 'inline-flex';
        } else {
          profileBadge.style.display = 'none';
        }
      }

      if (dockedBadge) {
        dockedBadge.textContent = count;
        dockedBadge.style.display = (count > 0 && !isModalOpen) ? 'inline-block' : 'none';
      }
      if (sidebarBadge) {
        sidebarBadge.textContent = count;
        sidebarBadge.style.display = (count > 0 && !isModalOpen) ? 'inline-block' : 'none';
      }

      // If unread messages exist from admin
      if (count > 0 && data.latest_message) {
        const latest = data.latest_message;
        const msgId = parseInt(latest.id, 10);

        if (msgId > lastNotifiedMessageId) {
          lastNotifiedMessageId = msgId;

          if (!isModalOpen) {
            // 1. Play Web Audio chime
            playMessageNotificationChime();

            // 2. Show floating notification toast banner with message preview
            showFloatingMessageAlert(latest);

            // 3. Flash document title
            flashTitleNotification(latest.sender_name || 'Elon Musk');
          }
        }
      } else if (count === 0) {
        resetTitleNotification();
      }
    }
  } catch (err) {
    console.warn('Check unread error:', err);
  }
}

async function sendDockedMessage() {
    const input = document.getElementById('dockedChatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const sent = await sendMessageToAdmin(text);
    if (sent) input.value = '';
}

async function sendModalMessage() {
    const input = document.getElementById('modalChatInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const sent = await sendMessageToAdmin(text);
    if (sent) input.value = '';
}

// Sends message to Admin without any bot simulation or automated fake replies
async function sendMessageToAdmin(message) {
    try {
        if (window.chatReady) {
            await window.chatReady;
        }

        if (!window.currentConversationId || !window.currentVisitor) {
            showToast('Chat is still loading. Please try again.');
            return false;
        }

        const sent = await window.sendMessage(message);

        if (!sent) {
            showToast('Message could not be sent.');
            return false;
        }

        await fetchLiveMessages(true);
        return true;

    } catch (error) {
        console.error('Supabase message error:', error);
        showToast('Unable to send message. Please try again.');
        return false;
    }
}

// Start 1.8s real-time sync polling
async function initRealtimeSync() {
    try {
        await window.chatReady;

        const conversationId = window.currentConversationId;

        if (!conversationId) {
            console.error('No conversation available.');
            return;
        }

        await fetchLiveMessages(true);

        if (window.supabaseMessageChannel) {
            await window.supabaseClient.removeChannel(
                window.supabaseMessageChannel
            );
        }

        window.supabaseMessageChannel = window.supabaseClient
            .channel('visitor-chat-' + conversationId)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages',
                    filter: 'conversation_id=eq.' + conversationId
                },
                () => fetchLiveMessages(true)
            )
            .subscribe((status) => {
                console.log('Chat realtime status:', status);
            });

    } catch (error) {
        console.error('Realtime initialization error:', error);
    }
}

// Auto-start sync when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRealtimeSync);
} else {
  initRealtimeSync();
}

// Subscribe Perks Modal
function openSubscribeModal() {
  document.getElementById('subscribeModal').style.display = 'flex';
}
function closeSubscribeModal() {
  document.getElementById('subscribeModal').style.display = 'none';
}
// Dynamic UI Buttons State & Handlers
let uiButtonsConfig = null;

async function fetchUiButtonsConfig() {
  try {
    const res = await fetch(`api/buttons.php?_nocache=${Date.now()}`);
    const data = await res.json();
    if (data.success && data.buttons) {
      uiButtonsConfig = data.buttons;
      if (uiButtonsConfig.btn_subscribe) {
        const subLbl = document.getElementById('subscribeBtnLabel');
        if (subLbl && uiButtonsConfig.btn_subscribe.button_label) {
          subLbl.textContent = uiButtonsConfig.btn_subscribe.button_label;
        }
      }
      const tabKeys = ['posts', 'replies', 'highlights', 'articles', 'media', 'likes'];
      tabKeys.forEach(k => {
        const tabObj = uiButtonsConfig['tab_' + k];
        if (tabObj && tabObj.button_label) {
          const tabBtn = document.querySelector(`.tab-btn[onclick*="'${k}'"]`);
          if (tabBtn) tabBtn.textContent = tabObj.button_label;
        }
      });
    }
  } catch (e) {
    console.warn('Could not fetch buttons config:', e);
  }
}

// Subscribe Button Handler - Non-clickable (Disabled per user specification)
async function handleSubscribeButtonClick(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  return false;
}

// Message Button Handler - Opens authentic in-page Twitter message box connected to Admin Live Chat
async function handleMessageButtonClick(btnEl) {
  openTwitterMessageBox();
}

// Mention Button Handler - Non-clickable (Disabled per user specification)
function handleMentionButtonClick(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  return false;
}

function confirmSubscription() {
  closeSubscribeModal();
  showToast('ðŸŽ‰ Welcome to @elonmusk VIP Subscriber Tier!');
  const subBtn = document.getElementById('btnProfileSubscribe');
  if (subBtn) {
    subBtn.innerHTML = '<span data-icon="sparkles"></span> <span>Subscribed</span>';
    subBtn.style.background = 'rgba(29, 155, 240, 0.2)';
    subBtn.style.borderColor = 'var(--twitter-blue)';
  }
}

// Notification Bell Toggle
function toggleNotificationBell() {
  isBellActive = !isBellActive;
  const btn = document.getElementById('btnNotificationBell');
  if (isBellActive) {
    btn.style.color = 'var(--twitter-blue)';
    btn.style.borderColor = 'var(--twitter-blue)';
    showToast('ðŸ”” Notifications turned on for @elonmusk');
  } else {
    btn.style.color = 'var(--text-primary)';
    btn.style.borderColor = 'var(--border-color)';
    showToast('ðŸ”• Notifications muted for @elonmusk');
  }
}

// Profile Options Menu Handlers
function openProfileOptionsMenu(btnEl) {
  const menu = document.getElementById('profileOptionsMenu');
  if (!menu) return;
  const rect = btnEl.getBoundingClientRect();
  menu.style.top = (rect.bottom + 8) + 'px';
  menu.style.left = Math.max(10, rect.left - 160) + 'px';
  menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
}

function closeProfileOptionsMenu() {
  const menu = document.getElementById('profileOptionsMenu');
  if (menu) menu.style.display = 'none';
}

function shareProfile() {
  closeProfileOptionsMenu();
  if (navigator.share) {
    navigator.share({
      title: 'Elon Musk (@elonmusk) on X',
      text: 'Check out Elon Musk on X: Owner @X, Founder @SpaceX, CEO @Tesla',
      url: window.location.href
    }).catch(() => copyProfileLink());
  } else {
    copyProfileLink();
  }
}

function copyProfileLink() {
  closeProfileOptionsMenu();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(window.location.origin + window.location.pathname);
  }
  showToast('ðŸ“‹ Copied profile link to clipboard');
}

function toggleMuteProfile() {
  closeProfileOptionsMenu();
  const isMuted = localStorage.getItem('muted_elonmusk') === '1';
  if (isMuted) {
    localStorage.removeItem('muted_elonmusk');
    showToast('Unmuted @elonmusk');
  } else {
    localStorage.setItem('muted_elonmusk', '1');
    showToast('Muted @elonmusk');
  }
}

function toggleBlockProfile() {
  closeProfileOptionsMenu();
  if (confirm('Block @elonmusk?\nThey will not be able to follow you or view your posts.')) {
    showToast('Blocked @elonmusk');
    const followBtn = document.getElementById('btnElonFollow');
    if (followBtn) {
      followBtn.textContent = 'Blocked';
      followBtn.classList.remove('following');
      followBtn.style.background = 'rgba(239,68,68,0.2)';
      followBtn.style.color = '#ef4444';
      followBtn.style.borderColor = '#ef4444';
    }
  }
}

function embedProfile() {
  closeProfileOptionsMenu();
  const embedCode = '<blockquote class="twitter-tweet"><a href="https://x.com/elonmusk">Tweets by @elonmusk</a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"><\/script>';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(embedCode);
  }
  showToast('ðŸ“‹ Embed code copied to clipboard');
}

let modalComposerMediaUrl = null;
let modalComposerMediaType = null;

function openComposerModal(initialText = '') {
  const modal = document.getElementById('composerModal');
  if (modal) {
    modal.style.display = 'flex';
    const textEl = document.getElementById('modalComposerText');
    if (textEl) {
      if (typeof initialText === 'string' && initialText.length > 0) {
        textEl.value = initialText;
      }
      textEl.focus();
      if (typeof textEl.setSelectionRange === 'function') {
        textEl.setSelectionRange(textEl.value.length, textEl.value.length);
      }
    }
  }
}

function closeComposerModal() {
  const modal = document.getElementById('composerModal');
  if (modal) modal.style.display = 'none';
  clearModalComposerMedia();
}

async function handleModalComposerUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const preview = document.getElementById('modalComposerPreview');
  const previewImg = document.getElementById('modalComposerImg');
  const status = document.getElementById('modalComposerUploadStatus');

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) previewImg.src = e.target.result;
      if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  if (status) status.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('media', file);

  try {
    const res = await fetch('api/admin_api.php?action=upload_post_media', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      modalComposerMediaUrl = data.url;
      modalComposerMediaType = data.media_type || (file.type.startsWith('video/') ? 'video' : 'image');
      if (previewImg) previewImg.src = data.url;
      if (preview) preview.style.display = 'block';
      if (status) status.textContent = 'Attached';
    } else {
      if (status) status.textContent = 'Upload failed';
      alert('Upload failed: ' + (data.error || 'Unknown error'));
      clearModalComposerMedia();
    }
  } catch (err) {
    if (status) status.textContent = 'Network error';
    alert('Upload failed: ' + err.message);
    clearModalComposerMedia();
  } finally {
    input.value = '';
  }
}

function clearModalComposerMedia() {
  modalComposerMediaUrl = null;
  modalComposerMediaType = null;
  const preview = document.getElementById('modalComposerPreview');
  if (preview) preview.style.display = 'none';
  const previewImg = document.getElementById('modalComposerImg');
  if (previewImg) previewImg.src = '';
  const status = document.getElementById('modalComposerUploadStatus');
  if (status) status.textContent = '';
  const fileInput = document.getElementById('modalComposerFileInput');
  if (fileInput) fileInput.value = '';
}

async function submitModalPost() {
  const textEl = document.getElementById('modalComposerText');
  const content = textEl ? textEl.value.trim() : '';
  if (!content && !modalComposerMediaUrl) {
    showToast('Please enter post content or upload an image');
    return;
  }

  try {
    const payload = {
      content: content || ' ',
      media_url: modalComposerMediaUrl,
      media_type: modalComposerMediaType
    };
    const res = await fetch('api/create_tweet.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data && data.success) {
      closeComposerModal();
      if (textEl) textEl.value = '';
      clearModalComposerMedia();
      showToast('ðŸŽ‰ Your post was sent to the timeline!');
      loadTweets(currentTab, false);
    } else {
      closeComposerModal();
      clearModalComposerMedia();
      showToast('ðŸŽ‰ Your post was published!');
      loadTweets(currentTab, false);
    }
  } catch (err) {
    closeComposerModal();
    clearModalComposerMedia();
    showToast('Your post was published!');
  }
}

function openSubscriptionsBadgeModal() {
  openFollowingModal();
}

// Tweet Options & Analytics Modal
function showTweetMenu(tweetId, btnEl) {
  openProfileOptionsMenu(btnEl);
}

function openAnalyticsModal(tweetId, views) {
  showToast(`ðŸ“Š ${formatNumber(views)} Impressions Â· 94.2K Engagements`);
}

// GIF & Schedule Modals
function openGifModal() {
  document.getElementById('gifModal').style.display = 'flex';
}
function closeGifModal() {
  document.getElementById('gifModal').style.display = 'none';
}
function selectGif(url) {
  const preview = document.getElementById('composerMediaPreview');
  const img = document.getElementById('mediaPreviewImg');
  if (preview && img) {
    img.src = url;
    img.style.display = 'block';
    preview.style.display = 'block';
    const btnSub = document.getElementById('btnSubmitInline');
    if (btnSub) btnSub.disabled = false;
  }
  closeGifModal();
}

function openScheduleModal() {
  document.getElementById('scheduleModal').style.display = 'flex';
}
function closeScheduleModal() {
  document.getElementById('scheduleModal').style.display = 'none';
}
function confirmSchedule() {
  closeScheduleModal();
  showToast('Post scheduled successfully');
}

// Other sidebar links
function openListsModal() {
  showToast('ðŸ“‹ Lists: SpaceX Updates, AI Frontier, Tesla Tech');
}
function openBookmarksModal() {
  const likesTabBtn = document.querySelector('.tab-btn[data-tab="likes"]');
  if (likesTabBtn) likesTabBtn.click();
  showToast('Showing your saved & bookmarked posts');
}
function openCommunitiesModal() {
  showToast('ðŸŒ Communities: Mars Colonization Society (840K members)');
}
function openSidebarMoreModal() {
  showToast('Settings, Analytics, Ads & Creator Studio');
}

// Reply Modal
function openReplyModal(tweetId, authorName, authorHandle, contentPreview) {
  const modal = document.getElementById('replyModal');
  document.getElementById('replyModalParentName').textContent = authorName;
  document.getElementById('replyModalParentHandle').textContent = authorHandle;
  document.getElementById('replyModalParentContent').textContent = contentPreview;
  document.getElementById('replyModalTweetId').value = tweetId;
  document.getElementById('replyModalText').value = '';
  modal.style.display = 'flex';
}
function closeReplyModal() {
  document.getElementById('replyModal').style.display = 'none';
}

async function submitReplyModal() {
  const tweetId = document.getElementById('replyModalTweetId').value;
  const content = document.getElementById('replyModalText').value.trim();
  if (!content) return;

  try {
    const res = await fetch('api/create_tweet.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content,
        reply_to_id: tweetId,
        as_elon: false
      })
    });
    const data = await res.json();
    if (data.success) {
      closeReplyModal();
      showToast('Your reply was sent.');
      loadTweets(currentTab, false);
    }
  } catch (err) {
    console.error('Reply error:', err);
  }
}

// Thread View Modal (Full Conversation)
async function openThreadModal(tweetId) {
  const modal = document.getElementById('threadModal');
  const body = document.getElementById('threadModalBody');
  body.innerHTML = '<div style="display:flex; justify-content:center; padding:40px; color:var(--twitter-blue);"><div style="width:28px; height:28px; border:3px solid var(--border-color); border-top-color:var(--twitter-blue); border-radius:50%; animation:spin 0.8s linear infinite;"></div></div>';
  modal.style.display = 'flex';

  try {
    const res = await fetch(`api/get_tweets.php?tweet_id=${tweetId}`);
    const data = await res.json();

    if (data.success && data.tweet) {
      let html = renderTweetCard(data.tweet);
      if (data.replies && data.replies.length > 0) {
        html += '<div style="padding:12px 16px; font-weight:800; font-size:16px; border-bottom:1px solid var(--border-color);">Replies</div>';
        html += data.replies.map(r => renderTweetCard(r)).join('');
      } else {
        html += '<div style="padding:20px; text-align:center; color:var(--text-secondary);">No replies yet. Be the first to reply!</div>';
      }
      body.innerHTML = html;
    }
  } catch (err) {
    body.innerHTML = '<div style="padding:20px; text-align:center; color:var(--twitter-pink);">Failed to load thread.</div>';
  }
}
function closeThreadModal() {
  document.getElementById('threadModal').style.display = 'none';
}

// Lightbox
function openLightbox(imageUrl) {
  const box = document.getElementById('lightboxModal');
  document.getElementById('lightboxImg').src = imageUrl;
  box.style.display = 'flex';
}
function closeLightbox() {
  document.getElementById('lightboxModal').style.display = 'none';
}

// Compose Modal
function openComposeModal() {
  openComposerModal();
}
function closeComposeModal() {
  closeComposerModal();
}

async function submitComposeModal() {
  await submitModalPost();
}

// Switch Active Perspective (Elon Musk / Visitor)
async function switchUser(userId) {
  try {
    const res = await fetch('api/user.php?action=switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    const data = await res.json();
    if (data.success) {
      closeUserSwitcher();
      showToast(`Switched perspective to ${userId === 1 ? '@elonmusk' : '@tech_explorer'}`);
      loadInitialData();
    }
  } catch (err) {
    console.error('Switch user error:', err);
  }
}

function toggleUserSwitcher() {
  const menu = document.getElementById('userSwitcherMenu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
  }
}
function closeUserSwitcher() {
  const menu = document.getElementById('userSwitcherMenu');
  if (menu) menu.style.display = 'none';
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toastContainer');
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 2800);
}

// Copy link to tweet
function shareTweet(tweetId) {
  const url = `${window.location.origin}${window.location.pathname}?tweet_id=${tweetId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
  }
  showToast('Copied link to clipboard');
}

function searchTrend(hashtag) {
  const searchInput = document.getElementById('rightSearchInput');
  if (searchInput) {
    searchInput.value = hashtag;
    searchInput.focus();
    handleSearch(hashtag);
  }
}

function viewUserProfile(handle) {
  if (handle === '@elonmusk' || handle === 'elonmusk') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showToast(`Viewing ${handle}`);
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

// Helper: Format @mentions, #hashtags, URLs
function formatTweetText(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" onclick="event.stopPropagation()">$1</a>');
  escaped = escaped.replace(/@(\w+)/g, '<a href="javascript:void(0);" onclick="event.stopPropagation(); viewUserProfile(\'@$1\')">@$1</a>');
  escaped = escaped.replace(/#(\w+)/g, '<a href="javascript:void(0);" onclick="event.stopPropagation(); searchTrend(\'#$1\')">#$1</a>');
  return escaped;
}

function formatNumber(num) {
  if (!num) return '0';
  const n = parseInt(num, 10);
  if (n >= 1000000) {
    return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return n.toLocaleString();
}

function escapeHtml(string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(string).replace(/[&<>"']/g, m => map[m]);
}

window.loadTweets = loadTweets;
window.loadMoreTweets = loadMoreTweets;
