// Inject origin trial tokens for content script context
function injectOriginTrialTokens() {
  const tokens = [
    'A8cGsoLxsPPTvdx7AK4T3wyAxMDfqQoRGlJ51SF2ULxFsZQNCJvtunv07+M4IyNd/IxnYG7s06rVnkNg+XdLkAQAAACPeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8va2dnY2JrY21hbG9nZ2xkaW5waWxvaGNkbWJpZ2NhYmciLCJmZWF0dXJlIjoiQUlQcm9tcHRBUElNdWx0aW1vZGFsSW5wdXQiLCJleHBpcnkiOjE3NzQzMTA0MDAsImlzVGhpcmRQYXJ0eSI6dHJ1ZX0=',
    'A3o4eYGsp27QDTdJpDqf79x/bNugHBLU0uwCRs7//s7usNQUUzfO5MoqPk4JT004FXPqOCH/1/uX9zU4VTpcPgQAAACFeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8va2dnY2JrY21hbG9nZ2xkaW5waWxvaGNkbWJpZ2NhYmciLCJmZWF0dXJlIjoiQUlQcm9vZnJlYWRlckFQSSIsImV4cGlyeSI6MTc3OTE0ODgwMCwiaXNUaGlyZFBhcnR5Ijp0cnVlfQ==',
    'AxoRPKFTReulC39vBPrTxfAMPOFh9VSXYF6mhIUEr/HKMoJhfvcZAQEg2U6niYttjMi5Thiv/nMKUOR/BhR9oAsAAACCeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8va2dnY2JrY21hbG9nZ2xkaW5waWxvaGNkbWJpZ2NhYmciLCJmZWF0dXJlIjoiQUlSZXdyaXRlckFQSSIsImV4cGlyeSI6MTc2OTQ3MjAwMCwiaXNUaGlyZFBhcnR5Ijp0cnVlfQ==',
    'A9UNzt+OouihNLCEV/EuDRhntIDobC0DVOgsDa6GknsFQoI9WeGabZ/rSWkezrbGo15tK8hk5wyZyOSx5V+JqwoAAACAeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8va2dnY2JrY21hbG9nZ2xkaW5waWxvaGNkbWJpZ2NhYmciLCJmZWF0dXJlIjoiQUlXcml0ZXJBUEkiLCJleHBpcnkiOjE3Njk0NzIwMDAsImlzVGhpcmRQYXJ0eSI6dHJ1ZX0='
  ];

  // Add meta tags for each token
  tokens.forEach(token => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'origin-trial';
    meta.content = token;
    document.head.append(meta);
  });
}

// Execute as soon as possible
if (document.head) {
  injectOriginTrialTokens();
} else {
  // If head is not available yet, wait for it
  const observer = new MutationObserver((mutations, obs) => {
    if (document.head) {
      injectOriginTrialTokens();
      obs.disconnect();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}