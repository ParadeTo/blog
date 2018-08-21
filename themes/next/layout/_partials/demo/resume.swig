{%
set resumeCh=page.resumeCh;
%}
{% set resumeEn=page.resumeEn; %}
<div id="resumeMain" class="{{= page.layout }}" itemscope itemprop="blogPost">

    <div class="wrapper">
        <ul id="lang">
            <li class="active" data-lang="ch">中文</li>
            <li data-lang="en">English</li>
        </ul>
        <div class="lang-container">
            <h2 id="titleName" class="sectionHead">{{= resumeCh.name }}</h2>

            <div id="bio">
                <h2>{{= resumeCh.vocation }}&nbsp;&nbsp;{{= resumeCh.birthday }}</h2>

                <!--SOCIAL LINKS-->
                <div id="socialIcons">
                    <a class="socialIcon" target="_blank" id="githubIcon" href="https://github.com/ParadeTo"></a>
                    <a class="socialIcon" target="_blank" id="blogIcon" href="http://www.paradeto.com"></a>
                    <!--<a class="socialIcon" target="_blank" id="dataguruIcon"-->
                       <!--href="http://f.dataguru.cn/space-uid-256390.html"></a>-->
                </div>
                <p>
                    {{= resumeCh.intro }}
                </p>
            </div>

            <div class="clear"></div>
            <h2 id="tools" class="sectionHead">技能</h2>
            <ul id="skills" class="ready">
                {% for s in resumeCh.skills %}
                <li id="skill1" data-score="{{= s.score }}">
                    <span class="skill-name" style="display: inline;">{{= s.name }}</span>
                    <span class="score"></span>
                </li>
                {% endfor %}
            </ul>
            <h2 id="clock" class="sectionHead">工作经历</h2>
            <!-- 工作经历-->
            <ul id="jobs" class="two-col">
                {% for e in resumeCh.experience %}
                <li>
                    <div class="details">
                        <h3 class="bold">{{= e.corp }}</h3>
                        <h4>{{= e.vocation }}</h4>
                        <h5>{{= e.period }}</h5>
                    </div>
                    <p>
                        {{- e.work }}
                    </p>
                </li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <h2 id="learn" class="sectionHead">教育经历</h2>
            <!-- 教育经历-->
            <ul id="schools" class="two-col">
                {% for e in resumeCh.education %}
                <li>
                    <div class="details">
                        <h3 class="bold">{{= e.school }}</h3>
                        <h4>{{= e.major}}&nbsp;&nbsp;{{= e.degree}}</h4>
                        <h5>{{= e.period}}</h5>
                    </div>
                    <p>{{= e.detail }}</p>
                </li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <!-- 获奖经历-->
            <h2 id="ribbon" class="sectionHead">荣誉 &amp; 奖励</h2>
            <ul id="honorsAwards">
                {% for h in resumeCh.honors %}
                <li>{{= h}}</li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <!-- 作品-->
            <h2 id="eye" class="sectionHead">作品</h2>
            <li><a href='/demo'>开源项目</a></li>
            <li><a href='https://github.com/ParadeTo'>github</a></li>
            <div class="clear"></div>
            <!-- 联系方式-->
            <h2 id="contact" class="sectionHead">联系方式</h2>
            <ul class="contact-list">
                <li>手机号码：{{= page.contact.tel}}</li>
                <li>电子邮箱：{{= page.contact.email}}</li>
                <li>QQ：{{= page.contact.qq}}</li>
                <li>微信号码：{{= page.contact.wechat}}</li>
            </ul>
        </div>
        <!-- 英文-->
        <div class="lang-container" style="display:none">
            <h2 id="titleName" class="sectionHead">{{= resumeEn.name }}</h2>

            <div id="bio">
                <h2>{{= resumeEn.vocation }}&nbsp;&nbsp;{{= resumeEn.birthday }}</h2>

                <!--SOCIAL LINKS-->
                <div id="socialIcons">
                    <a class="socialIcon" target="_blank" id="githubIcon" href="https://github.com/ParadeTo"></a>
                    <a class="socialIcon" target="_blank" id="blogIcon" href="http://www.paradeto.com"></a>
                    <!--<a class="socialIcon" target="_blank" id="dataguruIcon"-->
                       <!--href="http://f.dataguru.cn/space-uid-256390.html"></a>-->
                </div>
                <p>
                    {{= resumeEn.intro }}
                </p>
            </div>

            <div class="clear"></div>
            <h2 id="tools" class="sectionHead">Skills</h2>
            <ul id="skills" class="ready">
                {% for s in resumeEn.skills %}
                <li id="skill1" data-score="{{= s.score }}">
                    <span class="skill-name" style="display: inline;">{{= s.name }}</span>
                    <span class="score"></span>
                </li>
                {% endfor %}
            </ul>
            <h2 id="clock" class="sectionHead">Experience</h2>
            <!-- 工作经历-->
            <ul id="jobs" class="two-col">
                {% for e in resumeEn.experience %}
                <li>
                    <div class="details">
                        <h3 class="bold">{{= e.corp }}</h3>
                        <h4>{{= e.vocation }}</h4>
                        <h5>{{= e.period }}</h5>
                    </div>
                    <p>
                        {{- e.work }}
                    </p>
                </li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <h2 id="learn" class="sectionHead">Education</h2>
            <!-- 教育经历-->
            <ul id="schools" class="two-col">
                {% for e in resumeEn.education %}
                <li>
                    <div class="details">
                        <h3 class="bold">{{= e.school }}</h3>
                        <h4>{{= e.major}}&nbsp;&nbsp;{{= e.degree}}</h4>
                        <h5>{{= e.period}}</h5>
                    </div>
                    <p>{{= e.detail }}</p>
                </li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <!-- 获奖经历-->
            <h2 id="ribbon" class="sectionHead">Honors &amp; Awards</h2>
            <ul id="honorsAwards">
                {% for h in resumeEn.honors %}
                <li>{{= h}}</li>
                {% endfor %}
            </ul>
            <div class="clear"></div>
            <!-- 作品-->
            <h2 id="eye" class="sectionHead">Works</h2>
            <li><a href='/demo'>Open Source Projects</a></li>
            <li><a href='https://github.com/ParadeTo'>Github</a></li>
            <div class="clear"></div>
            <!-- 联系方式-->
            <h2 id="contact" class="sectionHead">Contact Me</h2>
            <ul class="contact-list">
                <li>Tel：{{= page.contact.tel}}</li>
                <li>Email：{{= page.contact.email}}</li>
                <li>QQ：{{= page.contact.qq}}</li>
                <li>Wechat：{{= page.contact.wechat}}</li>
            </ul>
        </div>
    </div>
    <!-- 英文简历-->
    <!--<div id="wrapper" class="en">-->
        <!--<h2 id="titleName" class="sectionHead">{{= resumeEn.name }}</h2>-->

        <!--<div id="bio">-->
            <!--<h2>WEB前端工程师&nbsp;&nbsp;1989.12</h2>-->

            <!--&lt;!&ndash;SOCIAL LINKS&ndash;&gt;-->
            <!--<div id="socialIcons">-->
                <!--<a class="socialIcon" target="_blank" id="githubIcon" href="https://github.com/ParadeTo"></a>-->
                <!--<a class="socialIcon" target="_blank" id="blogIcon" href="http://www.paradeto.com"></a>-->
                <!--<a class="socialIcon" target="_blank" id="dataguruIcon"-->
                   <!--href="http://www.dataguru.cn/home.php?mod=space&uid=256390&do=thread&view=me&from=space"></a>-->
            <!--</div>-->
            <!--<p>-->
                <!--Known as "THE MOLITOR", I'm a web designer and WordPress theme developer living in the outskirts of-->
                <!--Seattle with my wife and two kids. I'm an active author on ThemeForest where I enjoy spending my day in-->
                <!--Photoshop converting custom designs into fancy-pants-->
            <!--</p>-->
        <!--</div>-->

        <!--<div class="clear"></div>-->
        <!--<h2 id="tools" class="sectionHead">技能</h2>-->
        <!--<ul id="skills" class="ready">-->
           <!--<li id="skill1" data-score="90">-->
                <!--<span style="display: inline;">WordPress Development</span>-->
                <!--<span class="score"></span>-->
            <!--</li>-->
            <!--<li id="skill2" data-score="70">-->
                <!--<span style="display: inline;">PHP</span>-->
                <!--<span class="score"></span>-->
            <!--</li>-->
            <!--<li id="skill3" data-score="100">-->
                <!--<span style="display: inline;">HTML + CSS</span>-->
                <!--<span class="score"></span>-->
            <!--</li>-->

        <!--</ul>-->
        <!--<h2 id="clock" class="sectionHead">Experience</h2>-->
        <!--&lt;!&ndash; 工作经历&ndash;&gt;-->
        <!--<ul id="jobs" class="two-col">-->
            <!--<li>-->
                <!--<div class="details">-->
                    <!--<h3 class="bold">深圳齐牛互联网金融服务有限公司</h3>-->
                    <!--<h4>Overlord - City, State</h4>-->
                    <!--<h5>2015/03 - 今</h5>-->
                <!--</div>-->
                <!--<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut justo nibh, mattis sit amet consequat a, varius vitae metus. Proin pharetra sodales pellentesque.</p>-->
            <!--</li>-->
            <!--<li>-->
                <!--<div class="details">-->
                    <!--<h3>Some Other Company</h3>-->
                    <!--<h4>Lead Front-End Developer - City, State</h4>-->
                    <!--<h5>Jan 2010 - Jan 2011</h5>-->
                <!--</div>-->
                <!--<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut justo nibh, mattis sit amet consequat a, varius vitae metus. Proin pharetra sodales pellentesque.</p>-->
            <!--</li>-->
            <!--<li>-->
                <!--<div class="details">-->
                    <!--<h3>Another Company</h3>-->
                    <!--<h4>Creative Director - City, State</h4>-->
                    <!--<h5>Jun 2008 - Dec 2009</h5>-->
                <!--</div>-->
                <!--<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut justo nibh, mattis sit amet consequat a, varius vitae metus. Proin pharetra sodales pellentesque.</p>-->
            <!--</li>-->
        <!--</ul>-->
        <!--<div class="clear"></div>-->
        <!--<h2 id="learn" class="sectionHead">Education</h2>-->
        <!--&lt;!&ndash; 教育经历&ndash;&gt;-->
        <!--<ul id="schools" class="two-col">-->
            <!--<li>-->
                <!--<div class="details">-->
                    <!--<h3 class="bold">University of State</h3>-->
                    <!--<h4>Degree Title - Concentration</h4>-->
                    <!--<h5>2005 - 2007</h5>-->
                <!--</div>-->
                <!--<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut justo nibh, mattis sit amet consequat a, varius vitae metus. Proin pharetra sodales pellentesque.</p>-->
            <!--</li>-->
            <!--<li>-->
                <!--<div class="details">-->
                    <!--<h3>State University</h3>-->
                    <!--<h4>Degree Title - Concentration</h4>-->
                    <!--<h5>2001 - 2004</h5>-->
                <!--</div>-->
                <!--<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut justo nibh, mattis sit amet consequat a, varius vitae metus. Proin pharetra sodales pellentesque.</p>-->
            <!--</li>-->
        <!--</ul>-->
        <!--<div class="clear"></div>-->
        <!--&lt;!&ndash; 获奖经历&ndash;&gt;-->
        <!--<h2 id="ribbon" class="sectionHead">Honors &amp; Awards</h2>-->
        <!--<ul id="honorsAwards">-->
            <!--<li>Academy Award for Best Sound Design in a Bathroom</li>-->
            <!--<li>Emmy Award for Most Used Extra in a Drama</li>-->
            <!--<li>Grammy Award for Best Use of a Goat in a Soundtrack</li>-->
            <!--<li>S.A.G. Award for Touching the Ground</li>-->
            <!--<li>Presented with the Honor of Throwing Pies at Donald Trump</li>-->
            <!--<li>Featured in Dog &amp; Country Monthly (issue 298, pg. 20)</li>-->
        <!--</ul>-->
        <!--<div class="clear"></div>-->
        <!--&lt;!&ndash; 作品&ndash;&gt;-->
        <!--<h2 id="eye" class="sectionHead">As Seen On</h2>-->
        <!--<div class="project-content">-->

        <!--</div>-->
    <!--</div>-->
</div>
