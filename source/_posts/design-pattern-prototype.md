---
title: 设计模式之原型模式（TypeScript & Rust）
date: 2024-03-19 10:01:45
tags:
  - Design Pattern
categories:
  - rust
---

原型模式（Prototype Pattern）是一种创建型设计模式，它通过复制现有对象来创建新对象，而不是使用常规的实例化过程。当对象创建成本高或创建过程很复杂时，通过复制一个现有的对象，然后基于复制出来的对象进行修改是一个非常好的方法。我们的学渣小明是使用原型模式的高手。期末考试了，学渣小明什么都不会，不慌，使用原型模式即可。

The Prototype Pattern is a creational design pattern that involves creating new objects by copying existing objects, rather than using the regular instantiation process. When the cost of object creation is high or the creation process is complex, it's a great approach to copy an existing object and modify it as needed. Our student, Xiao Ming, who is not good at studying, is an expert in using the Prototype Pattern. When the final exams come, even if Xiao Ming doesn't know anything, there's no need to panic. He can simply use the Prototype Pattern.

# TypeScript

有一个试卷类 `ExaminationPaper`，包含名字 `string`、选择题 `Question[]` 和简答题 `Question[]` 三个属性：

There is a class called `ExaminationPaper` that contains three properties: name (`string`), choice questions (`Question[]`), and simple answer questions (`Question[]`).

```ts
interface Prototype {
  clone(): Prototype
}

class Question implements Prototype {
  private answer: string

  constructor(answer: string) {
    this.answer = answer
  }

  setAnswer(answer: string) {
    this.answer = answer
  }

  getAnswer(): string {
    return this.answer
  }

  clone(): Prototype {
    return new Question(this.answer)
  }
}

class ExaminationPaper implements Prototype {
  choiceQuestions: Question[]
  shortAnswerQuestions: Question[]
  name: string

  constructor(
    name: string,
    choiceQuestions: Question[],
    shortAnswerQuestions: Question[]
  ) {
    this.name = name
    this.choiceQuestions = choiceQuestions
    this.shortAnswerQuestions = shortAnswerQuestions
  }

  clone(): Prototype {
    return new ExaminationPaper(
      this.name,
      this.choiceQuestions.map((q) => q.clone() as Question),
      this.shortAnswerQuestions.map((q) => q.clone() as Question)
    )
  }

  print() {
    console.log(this.name, 'paper:')
    console.log(this.choiceQuestions.map((q) => q.getAnswer()))
    console.log(this.shortAnswerQuestions.map((q) => q.getAnswer()))
  }
}

const xiaohongPaper = new ExaminationPaper(
  'xiaohong',
  [new Question('A'), new Question('B')],
  [new Question('answer1.'), new Question('answer2.')]
)
xiaohongPaper.print()

// Copy xiaohong's paper
const xiaomingPager = xiaohongPaper.clone() as ExaminationPaper
// Modify name
xiaomingPager.name = 'xiaoming'
// For short answer questions, add a closing word to the end
xiaomingPager.shortAnswerQuestions.forEach((q) =>
  q.setAnswer(q.getAnswer() + `That's all, thanks!`)
)
xiaomingPager.print()
```

首先，小红实例化 `ExaminationPaper` 完成作答。然后，小明通过调用小红试卷的 `clone` 方法复制出一份新的实例，修改名字为 `xiaoming`，同时为了避免雷同，还“机智”地在每道简答题答案后面加上了一段特有结束语。这样，小明不费吹灰之力就白嫖了一份答案。

First, Xiao Hong instantiates an `ExaminationPaper` object to complete the answering. Then, Xiao Ming calls the `clone` method of Xiao Hong's paper to create a new instance, modifies the name to `xiaoming`, and cleverly adds a unique ending phrase after each answer to avoid similarities. This way, Xiao Ming effortlessly obtains a set of answers for himself.

从这个例子来看，原型模式很简单，关键在于实现 `Prototype` 的 `clone` 方法，并注意对复杂类型的属性进行深度拷贝。

From this example, the Prototype Pattern seems simple. The key is to implement the `clone` method in the `Prototype` and ensure deep copying of complex-type properties.

而对于 Rust 来说，借助其强大的宏的特性，实现原型模式则更加方便。

In the case of Rust, leveraging its powerful macro features makes implementing the Prototype Pattern even more convenient.

# Rust

```rust
#[derive(Clone)]
struct Question {
    answer: String,
}

impl Question {
    fn new(answer: &str) -> Self {
        Self {
            answer: answer.to_string(),
        }
    }

    fn get_answer(&self) -> &str {
        self.answer.as_str()
    }

    fn set_answer(&mut self, answer: String) {
        self.answer = answer
    }
}

#[derive(Clone)]
struct ExaminationPaper {
    choice_questions: Vec<Question>,
    short_answer_questions: Vec<Question>,
    name: String,
}

impl ExaminationPaper {
    fn new(
        name: &str,
        choice_questions: Vec<Question>,
        short_answer_questions: Vec<Question>,
    ) -> Self {
        Self {
            name: name.to_string(),
            choice_questions,
            short_answer_questions,
        }
    }

    fn print(&self) {
        println!("{} paper:", self.name);
        println!(
            "{}",
            self.choice_questions
                .iter()
                .map(|q| q.get_answer())
                .collect::<Vec<_>>()
                .join(" ")
        );
        println!(
            "{}",
            self.short_answer_questions
                .iter()
                .map(|q| q.get_answer())
                .collect::<Vec<_>>()
                .join(" ")
        );
    }
}

fn main() {
    let xiaohong_paper = &ExaminationPaper::new(
        "xiaohong",
        vec![Question::new("A"), Question::new("B")],
        vec![Question::new("answer1."), Question::new("answer2.")],
    );
    xiaohong_paper.print();

    let xiaoming_paper = &mut xiaohong_paper.clone();
    xiaoming_paper.name = "xiaoming".to_string();
    for q in xiaoming_paper.short_answer_questions.iter_mut() {
        q.set_answer(format!("{} {}", q.get_answer(), "That's all. Thanks!"));
    }
    xiaoming_paper.print();
}
```

可以看到，我们并没有给 `ExaminationPaper` 和 `Question` 实现 `clone` 方法，而只是在类型前面加上了 `#[derive(Clone)]`。

As you can see, we didn't implement the `clone` method for `ExaminationPaper` and `Question`. Instead, we simply added `#[derive(Clone)]` before the type declarations.

当在一个结构体或枚举类型上添加 `#[derive(Clone)]` 派生宏时，Rust 编译器会自动为该类型生成一个 `Clone trait` 的实现。

When you add the `#[derive(Clone)]` derive macro to a struct or enum type in Rust, the compiler automatically generates an implementation of the `Clone trait` for that type.

对于结构体类型，自动生成的 `Clone trait` 实现会逐个克隆每个字段，并返回一个新的结构体对象。这意味着每个字段都必须实现 `Clone trait` 或是基本类型（如整数、浮点数等），否则编译器会报错。

For struct types, the automatically generated `Clone` implementation clones each field one by one and returns a new struct object. This means that each field must implement the `Clone trait` or be a primitive type (such as integers, floating-point numbers, etc.), otherwise the compiler will throw an error.

对于枚举类型，自动生成的 `Clone trait` 实现会逐个克隆每个变体，并返回一个新的枚举对象。同样地，每个变体中的字段都必须实现 `Clone trait` 或是基本类型。

For enum types, the automatically generated `Clone` implementation clones each variant one by one and returns a new enum object. Similarly, each field within each variant must implement the `Clone trait` or be a primitive type.

这样通过使用 `#[derive(Clone)]`，我们可以轻松地为自定义类型生成克隆功能，且无需手动实现 `Clone trait`，可以减少很多样板代码。

By using `#[derive(Clone)]`, we can easily generate the cloning functionality for custom types without manually implementing the `Clone trait`. This helps reduce a lot of boilerplate code.
