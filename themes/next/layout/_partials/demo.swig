{% if page.title==='game2048' %}
  {% include './demo/game2048.swig' %}
{% elif page.title=='game77' %}
  {% include './demo/game77.swig' %}
{% elif page.title=='vue-date-range' %}
  {% include './demo/vue-date-range.swig' %}
{% endif %}