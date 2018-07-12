{% if page.title.indexOf('vue') > -1 %}
  <script src="//cdn.bootcss.com/vue/2.2.1/vue.min.js"></script>
{% endif %}

{% if page.title==='game2048' %}
  <script src="/js/game2048/support2048.js"></script>
  <script src="/js/game2048/showanimation2048.js"></script>
  <script src="/js/game2048/main2048.js"></script>
{% elif page.title==='game77' %}
  <script src="/js/game77/index.js"></script>
{% elif page.title==='vue-date-range' %}
  <script src="//cdn.bootcss.com/moment.js/2.17.1/moment.min.js"></script>
  <script src="/js/vue-date-range/vue-date-range.min.js"></script>
  <script src="/js/vue-date-range/index.js"></script>
{% endif %}