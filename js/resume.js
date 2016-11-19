/**
 * Created by ayou on 2016-06-16.
 */
$(function(){
  var skillDic = {
    'ch':[
      '幼儿园',
      '小学生',
      '初中生',
      '高中生',
      '大学生',
      '硕士研究生',
      '博士研究生'
    ],
    'en':[
      'kindergarten',
      'pupil',
      'junior',
      'senior',
      'college',
      'master',
      'phd'
    ]
  };



  $('ul#skills').addClass("ready");
  skillsAnimation();

  // 技能动画
  function skillsAnimation() {
    var lang = $('#lang .active').data('lang');
    var langSkillDic = skillDic[lang];
    var skillLength = langSkillDic.length;
    var skillLevel = 100/skillLength;
    $('ul#skills li').each(function(){
      var i = $(this).index();
      var score = $(this).data('score');
      $(this).css('width',score+'%');
      var skillIndex = Math.floor(score / skillLevel) == skillLength? skillLength-1 : Math.floor(score / skillLevel);
      $(this).children('.score').html(langSkillDic[skillIndex]);
      $(this).delay(100 * i).animate({right:"0%"},1000,function(){
        $(this).children('span').fadeIn(600);
      });
    });
  }

  // 技能还原
  function resetSkills () {
    $('ul#skills li').each(function(){
      var $this = $(this);
      $this.css('width','0%');
      $this.css('right','100%');
    })
  }

//  中英文切换
  $('#lang li').on('click', function() {
    resetSkills();
    var $li = $('#lang li');
    var $this = $(this);
    var index = $this.index();
    $li.removeClass('active').eq(index).addClass('active');
    $('.lang-container').fadeOut().eq(index).fadeIn();
    skillsAnimation();
  });
});