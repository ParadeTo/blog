/**
 * Created by ayou on 2016-06-16.
 */
(function(){
  var skillDic = [
    '幼儿园',
    '小学生',
    '初中生',
    '高中生',
    '大学生',
    '硕士研究生',
    '博士研究生',
  ];
  var skillLength = skillDic.length;
  var skillLevel = 100/skillLength;
  ////////////////
  //SKILLS ANIMATION
  ////////////////
  $('ul#skills').addClass("ready");
  $('ul#skills li').each(function(){
    var i = $(this).index();
    var score = $(this).data('score');
    $(this).css('width',score+'%');
    var skillIndex = Math.floor(score / skillLevel) == skillLength? skillLength-1 : Math.floor(score / skillLevel);
    $(this).children('.score').html(skillDic[skillIndex]);
    $(this).delay(100 * i).animate({right:"0%"},1000,function(){
      $(this).children('span').fadeIn(600);
    });
  });
})()