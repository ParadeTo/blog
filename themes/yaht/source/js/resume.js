/**
 * Created by ayou on 2016-06-16.
 */
(function(){
  var skillDic = {
    0: '小学生',
    1: '初中生',
    2: '高中生',
    3: '大学生',
    4: '研究生'
  }
  ////////////////
  //SKILLS ANIMATION
  ////////////////
  $('ul#skills').addClass("ready");
  $('ul#skills li').each(function(){
    var i = $(this).index();
    var score = $(this).data('score');
    $(this).css('width',score+'%');
    var skillIndex = Math.floor(score / 20) == 5 ? 4 : Math.floor(score / 20);
    $(this).children('.score').html(skillDic[skillIndex]);
    $(this).delay(100 * i).animate({right:"0%"},1000,function(){
      $(this).children('span').fadeIn(600);
    });
  });
})()