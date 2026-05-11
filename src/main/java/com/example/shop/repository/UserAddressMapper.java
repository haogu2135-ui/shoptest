package com.example.shop.repository;

import com.example.shop.entity.UserAddress;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface UserAddressMapper {

    List<UserAddress> findByUserId(Long userId);

    UserAddress findById(Long id);

    UserAddress findDefaultByUserId(Long userId);

    int insert(UserAddress address);

    int update(UserAddress address);

    int deleteById(Long id);

    int clearDefault(Long userId);

    int setDefault(@Param("id") Long id, @Param("userId") Long userId);
}
