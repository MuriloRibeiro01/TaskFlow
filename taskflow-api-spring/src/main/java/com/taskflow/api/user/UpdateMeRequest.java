package com.taskflow.api.user;

import jakarta.validation.constraints.Size;

/** Só a rotina é editável; o resto do perfil vem do login. Texto em branco apaga a rotina. */
public record UpdateMeRequest(@Size(max = 2000) String routineText) {}
