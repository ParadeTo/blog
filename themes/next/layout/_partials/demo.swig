{% if page.title==='game2048' %}
  {% include './demo/game2048.swig' %}
{% elif page.title=='game77' %}
  {% include './demo/game77.swig' %}
{% elif page.title=='vue-date-range' %}
  {% include './demo/vue-date-range.swig' %}
{% elif page.title=='vue-tree-list' %}
  {% include './demo/vue-tree-list.swig' %}
{% elif page.title=='resume' %}
  {% include './demo/resume.swig' %}
{% elif page.title=='vue-tcp' %}
  {% include './demo/vue-tcp.swig' %}
{% elif page.title=='vue-float' %}
  {% include './demo/vue-float.swig' %}
{% endif %}