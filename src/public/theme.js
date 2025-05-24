// 主题管理系统

// 在HTML解析前应用主题，防止初始闪烁
(function() {
  // 尝试从localStorage读取用户主题偏好
  const savedTheme = localStorage.getItem('userThemePreference');
  
  // 如果有保存的主题偏好，立即应用
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // 检查系统主题
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    // 检查当前时间
    const currentHour = new Date().getHours();
    if (currentHour >= 19 || currentHour < 7) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
  
  // 添加类以防止过渡效果在页面加载时触发
  document.documentElement.classList.add('no-transition');
})();

document.addEventListener('DOMContentLoaded', () => {
  // 创建主题切换按钮
  createThemeToggle();
  
  // 初始化主题
  initTheme();
  
  // 监听系统主题变化
  listenForSystemThemeChanges();
  
  // 移除阻止过渡效果的类
  setTimeout(() => {
    document.documentElement.classList.remove('no-transition');
  }, 100);
});

// 创建主题切换按钮
function createThemeToggle() {
  const themeSwitch = document.createElement('div');
  themeSwitch.className = 'theme-switch';
  themeSwitch.setAttribute('title', '切换亮/暗主题');
  themeSwitch.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  `;
  
  // 更新为当前主题的图标
  const currentTheme = document.documentElement.getAttribute('data-theme');
  updateThemeIcon(currentTheme);
  
  // 添加点击事件监听
  themeSwitch.addEventListener('click', toggleTheme);
  
  // 添加到页面
  document.body.appendChild(themeSwitch);
}

// 初始化主题
function initTheme() {
  // 首先检查用户的主题偏好
  const savedTheme = localStorage.getItem('userThemePreference');
  if (savedTheme) {
    applyTheme(savedTheme);
    return;
  }
  
  // 如果没有用户偏好，检查系统主题
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
    return;
  }
  
  // 检查当前时间
  const currentHour = new Date().getHours();
  if (currentHour >= 19 || currentHour < 7) {
    applyTheme('dark');
    return;
  }
  
  // 如果没有特殊情况，使用亮色主题
  applyTheme('light');
}

// 应用主题
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
  localStorage.setItem('userThemePreference', theme);
}

// 更新主题图标
function updateThemeIcon(theme) {
  const themeIcon = document.querySelector('.theme-icon');
  
  if (!themeIcon) return;
  
  if (theme === 'dark') {
    // 使用CSS类切换动画而不是直接修改innerHTML
    themeIcon.classList.add('dark-mode');
    themeIcon.innerHTML = `
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    `;
  } else {
    themeIcon.classList.remove('dark-mode');
    themeIcon.innerHTML = `
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    `;
  }
}

// 切换主题
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  // 添加过渡类，启用平滑动画
  document.documentElement.classList.add('theme-transition');
  
  // 应用新主题
  applyTheme(newTheme);
  
  // 切换动画效果
  const themeSwitch = document.querySelector('.theme-switch');
  if (themeSwitch) {
    themeSwitch.classList.add('theme-switch-animate');
    setTimeout(() => {
      themeSwitch.classList.remove('theme-switch-animate');
    }, 700);
  }
}

// 监听系统主题变化
function listenForSystemThemeChanges() {
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      // 只有当用户没有手动设置主题时才跟随系统
      if (!localStorage.getItem('userThemePreference')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// 基于时间自动切换主题的功能
function scheduleThemeChange() {
  // 只有当用户没有手动设置主题时才自动切换
  if (!localStorage.getItem('userThemePreference')) {
    const currentHour = new Date().getHours();
    if (currentHour >= 19 || currentHour < 7) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }
  }
  
  // 每小时检查一次
  setTimeout(scheduleThemeChange, 3600000);
}

// 启动基于时间的主题切换
scheduleThemeChange();

// 侧边导航功能
document.addEventListener('DOMContentLoaded', function() {
  initSideNavigation();
});

// 初始化侧边导航
function initSideNavigation() {
  // 获取所有卡片
  const cards = document.querySelectorAll('.card');
  const navContent = document.querySelector('.side-nav-content');
  const trigger = document.querySelector('.side-nav-trigger');
  const menu = document.querySelector('.side-nav-menu');
  
  if (!cards.length || !navContent) return;
  
  // 为每个卡片创建导航项
  cards.forEach((card, index) => {
    // 尝试获取卡片标题
    let title = '';
    const h2 = card.querySelector('h2');
    const h1 = card.querySelector('h1');
    
    if (h2) {
      title = h2.textContent.trim();
    } else if (h1) {
      title = h1.textContent.trim();
    } else {
      title = `部分 ${index + 1}`;
    }
    
    // 创建导航项
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.setAttribute('data-target', index);
    
    // 创建导航点
    const dot = document.createElement('div');
    dot.className = 'nav-item-dot';
    
    // 创建标题
    const titleSpan = document.createElement('div');
    titleSpan.className = 'nav-item-title';
    titleSpan.textContent = title;
    
    navItem.appendChild(dot);
    navItem.appendChild(titleSpan);
    navContent.appendChild(navItem);
    
    // 点击事件：滚动到对应卡片
    navItem.addEventListener('click', (e) => {
      e.preventDefault();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  
  // 使用 Intersection Observer 检测当前可见的卡片
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = Array.from(cards).indexOf(entry.target);
        updateActiveNavItem(index);
      }
    });
  }, { threshold: 0.3 });
  
  // 观察所有卡片
  cards.forEach(card => {
    observer.observe(card);
  });
  
  // 更新活动导航项
  function updateActiveNavItem(index) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.nav-item[data-target="${index}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
      
      // 确保活动项在可视区域内
      if (activeItem.offsetTop < navContent.scrollTop || 
          activeItem.offsetTop > navContent.scrollTop + navContent.clientHeight) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
  
  // 移动端触摸事件处理
  if (trigger && menu) {
    trigger.addEventListener('touchstart', function(e) {
      e.preventDefault();
      this.classList.toggle('touch-active');
      menu.classList.toggle('touch-active');
    });
    
    // 点击其他区域关闭移动端目录
    document.addEventListener('touchstart', function(e) {
      if (!e.target.closest('.side-nav-trigger') && !e.target.closest('.side-nav-menu')) {
        trigger.classList.remove('touch-active');
        menu.classList.remove('touch-active');
      }
    });
  }
} 