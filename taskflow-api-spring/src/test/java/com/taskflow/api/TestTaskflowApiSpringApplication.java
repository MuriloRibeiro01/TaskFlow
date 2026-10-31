package com.taskflow.api;

import org.springframework.boot.SpringApplication;

public class TestTaskflowApiSpringApplication {

	public static void main(String[] args) {
		SpringApplication.from(TaskflowApiSpringApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
