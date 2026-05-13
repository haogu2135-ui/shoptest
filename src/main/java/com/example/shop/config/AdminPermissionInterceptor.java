package com.example.shop.config;

import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

@Component
@RequiredArgsConstructor
public class AdminPermissionInterceptor implements HandlerInterceptor {
    private final AdminRoleService adminRoleService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())
                || (!request.getServletPath().startsWith("/admin")
                && (HttpMethod.GET.matches(request.getMethod()) || HttpMethod.HEAD.matches(request.getMethod())))) {
            return true;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (!adminRoleService.canAccess(user.getId(), request.getServletPath())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No permission for this admin page");
        }
        return true;
    }
}
